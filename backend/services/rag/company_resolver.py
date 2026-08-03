"""services/rag/company_resolver.py
Works out which listed companies a free-text question is about.

Two things depend on getting this right:
  * retrieval re-weighting — a question naming HDFC Bank should not be
    out-ranked by a better-worded passage about a different bank;
  * on-demand indexing — the corpus only grows to cover a company once we know
    the user asked about it.

Deliberately NOT an LLM call. Resolving "Reliance" to RELIANCE is a lookup
against a table this app already keeps fully synced (company_metrics, ~6700
rows), and spending a model round-trip on it would add cost and latency to
every single question to answer something a dictionary answers exactly. It
would also be less reliable: a model will happily invent a plausible-looking
symbol for a company that is not listed, which is the one failure mode this
must not have.

The matching is deliberately conservative. A false positive here is worse than
a miss: wrongly deciding a question is "about TCS" biases retrieval towards TCS
and can trigger an on-demand index of a company nobody asked about.
"""
import logging
import re
from dataclasses import dataclass

from sqlalchemy import func, or_, select

from core.database import async_session_maker
from models.models import CompanyMetric

logger = logging.getLogger("services.rag.company_resolver")

# Words that look like symbols but never are. Without this, "PE", "IT", "CEO"
# and friends resolve to real listed symbols and quietly hijack retrieval.
_SYMBOL_STOPWORDS = {
    "A", "AN", "AND", "ARE", "AS", "AT", "BE", "BUT", "BY", "CAN", "DID", "DO",
    "FOR", "GET", "HAS", "HOW", "IF", "IN", "IS", "IT", "ITS", "MY", "NO", "NOT",
    "OF", "ON", "OR", "SO", "THE", "TO", "UP", "US", "WAS", "WHY", "YOU",
    "PE", "PB", "EPS", "ROE", "ROCE", "EBITDA", "PAT", "CAGR", "IPO", "FII",
    "DII", "NAV", "SIP", "GST", "RBI", "SEBI", "NSE", "BSE", "CEO", "CFO",
    "USD", "INR", "YOY", "QOQ", "FY", "IT", "AI", "ESG", "NPA", "NIM", "AUM",
    "Q1", "Q2", "Q3", "Q4", "P", "E", "B",
}

# Trailing corporate suffix stripped before name matching so "Reliance
# Industries" matches the row stored as "Reliance Industries Ltd". Anchored to
# the END on purpose, and kept character-for-character identical to
# _SQL_SUFFIX_PATTERN below — the Python side normalises the user's phrase and
# the SQL side normalises the stored name, and the two must agree exactly or
# every name lookup silently returns nothing.
_SUFFIX_RE = re.compile(
    r"\s+(limited|ltd\.?|pvt\.?|private|corporation|corp\.?|inc\.?|plc)\s*$",
    re.IGNORECASE,
)
_SQL_SUFFIX_PATTERN = r"\s+(limited|ltd\.?|pvt\.?|private|corporation|corp\.?|inc\.?|plc)\s*$"
_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9&.\-]*")
_UPPER_TOKEN_RE = re.compile(r"\b[A-Z][A-Z0-9&\-]{2,}\b")


@dataclass(slots=True)
class ResolvedCompany:
    symbol: str
    name: str
    sector: str | None
    # 'symbol' (the question typed the ticker) or 'name' (it typed the company
    # name). Kept because the two justify different confidence downstream.
    matched_on: str


def _normalise_name(name: str) -> str:
    return re.sub(r"\s+", " ", _SUFFIX_RE.sub("", name)).strip().lower()


def _normalised_name_column():
    """The stored company name, lowercased with its trailing corporate suffix
    removed — the SQL mirror of _normalise_name, evaluated in Postgres so the
    comparison stays an indexable expression instead of pulling 6700 rows into
    Python to compare them one at a time."""
    return func.regexp_replace(func.lower(CompanyMetric.name), _SQL_SUFFIX_PATTERN, "", "gi")


def _candidate_symbols(question: str) -> set[str]:
    """Uppercase runs of 3+ characters — how a ticker is actually written."""
    return {
        token for token in _UPPER_TOKEN_RE.findall(question)
        if token not in _SYMBOL_STOPWORDS
    }


def _candidate_phrases(question: str, max_words: int = 4) -> list[str]:
    """Every 1-to-4-word window of the question, longest first.

    Longest-first matters: "HDFC Bank" and "HDFC" are both real companies, and
    a user typing the former means the former. Checking long windows first and
    stopping once a window matches gets that right without any special-casing.
    """
    tokens = _TOKEN_RE.findall(question)
    phrases: list[str] = []
    for size in range(min(max_words, len(tokens)), 0, -1):
        for start in range(len(tokens) - size + 1):
            phrase = " ".join(tokens[start:start + size])
            if len(phrase) >= 3:
                phrases.append(phrase)
    return phrases


async def resolve_companies(question: str, limit: int = 4) -> list[ResolvedCompany]:
    """Companies the question plausibly refers to, best match first."""
    if not question or not question.strip():
        return []

    symbols = _candidate_symbols(question)
    phrases = _candidate_phrases(question)
    # One-word phrases are only worth a lookup if they are distinctive. A
    # single common word ("bank", "power", "india") matches dozens of rows and
    # none of them is what was meant.
    single_word_blocklist = {
        "bank", "power", "india", "indian", "steel", "cement", "auto", "finance",
        "energy", "motors", "industries", "technologies", "services", "share",
        "shares", "stock", "stocks", "market", "company", "sector", "price",
    }
    phrases = [p for p in phrases if " " in p or (len(p) > 3 and p.lower() not in single_word_blocklist)]
    if not symbols and not phrases:
        return []

    normalised_phrases = {_normalise_name(p): p for p in phrases if _normalise_name(p)}

    async with async_session_maker() as session:
        conditions = []
        if symbols:
            conditions.append(CompanyMetric.symbol.in_(sorted(symbols)))
        if normalised_phrases:
            # Corporate suffixes removed on BOTH sides — see
            # _normalised_name_column.
            conditions.append(_normalised_name_column().in_(sorted(normalised_phrases)))
        if not conditions:
            return []

        rows = (
            await session.execute(
                select(CompanyMetric)
                .where(or_(*conditions))
                # Largest first, so an ambiguous name resolves to the company a
                # user is overwhelmingly more likely to mean.
                .order_by(CompanyMetric.market_cap.desc().nullslast())
                .limit(limit * 3)
            )
        ).scalars().all()

    resolved: list[ResolvedCompany] = []
    seen: set[str] = set()
    for row in rows:
        if row.symbol in seen:
            continue
        seen.add(row.symbol)
        resolved.append(
            ResolvedCompany(
                symbol=row.symbol,
                name=row.name,
                sector=row.sector,
                matched_on="symbol" if row.symbol in symbols else "name",
            )
        )
        if len(resolved) >= limit:
            break

    if resolved:
        logger.info(
            "[rag.resolver] question resolved to: %s",
            ", ".join(f"{c.symbol} (by {c.matched_on})" for c in resolved),
        )
    return resolved
