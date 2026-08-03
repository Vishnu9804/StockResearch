"""agents/research_chat/guardrails.py
Two checks, one before the model call and one after.

BEFORE — is this a market question at all?
Deliberately asymmetric, and that asymmetry is the design. A cheap classifier
that tried to decide both "in scope" and "out of scope" would inevitably reject
real market questions phrased in ways nobody anticipated, and a research tool
that refuses valid questions is worse than one that occasionally answers a
stray one. So the gate only ever fires on a CLEAR out-of-scope signal with no
market signal anywhere in the message; everything ambiguous is passed through
to the model, whose system instruction already carries a strict scope rule
(prompts.py rule 5). Two layers, cheap-and-certain first, expensive-and-nuanced
second.

Not an LLM call, for the same reason nothing else on this path is: this runs on
every message, and spending a model round-trip to reject "what's a good pasta
recipe" would cost more than answering it.

AFTER — did the answer slip into advice?
The prompt forbids it, but a prompt is not an enforcement mechanism, and this
is the one rule where being wrong has real consequences for the user and for
the operator. The check strips the offending SENTENCE rather than discarding
the whole answer: a 400-word research note with one stray "investors should
consider accumulating" is 399 words of legitimate research, and throwing it
away would punish the user for the model's slip.
"""
import logging
import re

logger = logging.getLogger("agents.research_chat.guardrails")


# ── Before the call: scope gate ──────────────────────────────────────────────

# Any of these means "this is plausibly about markets" — the gate never fires.
# Broad on purpose: a false positive here just means the model gets asked, and
# the model has its own scope rule.
_MARKET_SIGNALS = re.compile(
    r"\b(stock|stocks|share|shares|equity|equities|market|markets|nifty|sensex|"
    r"nse|bse|sebi|rbi|ipo|listed|listing|company|companies|business|sector|"
    r"industry|invest|investing|investor|investment|portfolio|holding|holdings|"
    r"watchlist|screener|screen|ratio|ratios|valuation|fundamental|fundamentals|"
    r"technical|dividend|earnings|profit|revenue|sales|margin|margins|ebitda|"
    r"pat|eps|p ?/ ?e|pe ratio|p ?/ ?b|roe|roce|debt|leverage|balance sheet|"
    r"cash ?flow|quarterly|annual report|results|concall|con ?call|transcript|"
    r"management|promoter|fii|dii|mutual fund|sip|bond|bonds|yield|interest rate|"
    r"repo|inflation|gdp|economy|economic|rupee|currency|commodity|commodities|"
    r"crude|gold|silver|steel|cement|bank|banking|nbfc|insurance|pharma|auto|"
    r"it services|fmcg|infra|infrastructure|energy|power|telecom|realty|"
    r"trade|trading|price|prices|cmp|target|risk|risks|red flag|moat|peer|peers|"
    r"finscreen|feed|alert|alerts|custom ratio|query|dashboard|chart|"
    r"buy|sell|hold|bullish|bearish|rally|correction|crash|volatile|volatility|"
    r"capex|order book|guidance|merger|acquisition|demerger|buyback|split|bonus|"
    r"delisting|insider|bulk deal|block deal|shareholding|crore|lakh|"
    r"ltd|limited|corp|inc)\b",
    re.IGNORECASE,
)

# Clear, unambiguous out-of-scope intents. Each needs to be something no real
# market question would contain — "recipe" and "prescribe" qualify; "code" and
# "write" do not, because "what does the company code its revenue as" and
# "write me a summary" are both legitimate.
_OFF_TOPIC_SIGNALS = re.compile(
    r"\b(recipe|cook|cooking|bake|restaurant menu|"
    r"movie|film|song|lyrics|netflix|anime|cricket score|football match|"
    r"girlfriend|boyfriend|dating|marriage proposal|"
    r"symptom|symptoms|diagnos\w*|prescribe|medicine for|doctor for|"
    r"homework|essay for (my|school|college)|assignment for|"
    r"python (code|script|function)|javascript|write me (a|some) code|"
    r"debug (this|my)|sql query for my|regex for|"
    r"weather (today|tomorrow|in)|joke|poem about|translate this to|"
    r"who won the|capital of|tallest|largest country)\b",
    re.IGNORECASE,
)

# The one greeting-shaped case worth handling specially: it is not off-topic
# enough to refuse, and not a question worth spending a model call and a
# retrieval pass on.
_GREETING = re.compile(
    r"^\s*(hi|hello|hey|yo|hii+|namaste|good (morning|afternoon|evening)|"
    r"thanks|thank you|thx|ok|okay|cool|nice|great)\s*[!.?]*\s*$",
    re.IGNORECASE,
)

GREETING_REPLY = (
    "Hello. I'm FinScreen Research — I dig through company fundamentals, earnings-call "
    "transcripts, exposure profiles and market news to answer research questions.\n\n"
    "Try something like:\n"
    "- *What are the red flags in Reliance Industries?*\n"
    "- *What did HDFC Bank's management say about margins on the last call?*\n"
    "- *What's driving the infrastructure sector right now?*\n"
    "- *Where do I create a custom ratio in FinScreen?*"
)


def is_greeting(question: str) -> bool:
    return bool(_GREETING.match(question or ""))


def is_clearly_off_topic(question: str) -> bool:
    """True only when there is an explicit off-topic signal AND no market signal
    anywhere in the message. Both conditions are required — "is there a good
    pharma stock, and also what's the weather" has a market signal and goes
    through."""
    if not question or not question.strip():
        return False
    if not _OFF_TOPIC_SIGNALS.search(question):
        return False
    if _MARKET_SIGNALS.search(question):
        return False
    logger.info("[research_chat.guardrails] rejected as off-topic before any model call")
    return True


# ── After the call: advice check ─────────────────────────────────────────────

# Every pattern here is DIRECTIVE — it tells the reader what to do, or asserts
# a verdict. Bare words are deliberately absent: "buy" alone appears in "the
# company buys nickel", "target" in "the government's target", "recommend" in
# "the board recommended a dividend". Matching those would gut legitimate
# research prose, which is exactly the failure that makes naive banned-word
# lists unusable here.
_ADVICE_PATTERNS = re.compile(
    r"("
    r"\b(you|investors?|traders?|one|readers?|we)\s+(should|could|may want to|might want to|"
    r"ought to|can consider|should consider)\s+(buy|sell|hold|accumulate|book|exit|enter|"
    r"invest|add|reduce|trim|average|switch)"
    r"|\b(i|we)\s+(would\s+)?(recommend|suggest|advise)\b"
    r"|\bmy\s+(recommendation|advice|call|view is to)\b"
    r"|\b(strong|clear|outright)\s+(buy|sell)\b"
    r"|\b(target|fair)\s+(price|value)\s+(of|is|:)"
    r"|\bprice\s+target\b"
    r"|\bworth\s+(buying|selling|accumulating|a buy)\b"
    r"|\b(is|looks like)\s+a\s+(good|great|solid|safe)\s+(buy|bet|investment|pick|entry)\b"
    r"|\b(book|take)\s+(your\s+)?profits?\b"
    r"|\badd\s+(it\s+)?to\s+your\s+portfolio\b"
    r"|\b(invest|buy)\s+now\b"
    r"|\bupside\s+potential\s+of\s+\d"
    r"|\b(best|top)\s+stocks?\s+to\s+buy\b"
    r")",
    re.IGNORECASE,
)

# Split on sentence ends while KEEPING the terminator, so removing a sentence
# leaves the surrounding prose intact instead of running two sentences together.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")

_ADVICE_REPLACEMENT = (
    "*(A recommendation was removed here — this assistant gives research, not "
    "buy/sell calls.)*"
)


def strip_advice(answer: str) -> tuple[str, int]:
    """Remove any sentence that reads as investment advice.

    Returns the cleaned answer and how many sentences were removed. The count
    is stored on the message so a persistent rate of removals is visible as a
    prompt problem to fix, rather than being silently patched over forever.
    """
    if not answer or not _ADVICE_PATTERNS.search(answer):
        return answer, 0

    cleaned_lines: list[str] = []
    removed = 0
    for line in answer.split("\n"):
        if not _ADVICE_PATTERNS.search(line):
            cleaned_lines.append(line)
            continue

        # Operate per line so markdown structure (bullets, headings, blank
        # lines) survives; a global sentence split would flatten the document.
        kept = [s for s in _SENTENCE_SPLIT.split(line) if s and not _ADVICE_PATTERNS.search(s)]
        removed += len(_SENTENCE_SPLIT.split(line)) - len(kept)
        if kept:
            cleaned_lines.append(" ".join(kept))
        else:
            # Dropping the line entirely would leave a dangling bullet or a
            # gap the reader cannot account for. Say what happened instead.
            prefix_match = re.match(r"^(\s*(?:[-*+]|\d+\.)\s+)", line)
            prefix = prefix_match.group(1) if prefix_match else ""
            cleaned_lines.append(f"{prefix}{_ADVICE_REPLACEMENT}")

    logger.warning(
        "[research_chat.guardrails] stripped %d advice sentence(s) from an answer — "
        "if this recurs, the system instruction needs tightening, not just this filter",
        removed,
    )
    return "\n".join(cleaned_lines), removed
