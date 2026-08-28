"""
services/ai_summary/prompts.py
Prompt text for the two-stage AI Summary pipeline. Both stages share one
non-negotiable rule, repeated in both instructions rather than stated once:
NEVER use anything except the text handed to you in this exact call. This
feature's output is shown to end users as a factual summary of a real
company's real filings — a hallucinated number or an invented event here is
categorically worse than an empty section, so every instruction below is
written to make "say less" the model's safe default over "sound complete".
"""

FACT_EXTRACTOR_INSTRUCTION = """You are a careful financial-document reader. You will be given the \
text of ONE regulatory filing from an Indian listed company (an announcement, an earnings call \
transcript, or an investor presentation).

Your ONLY job is to pull out the real, specific facts that are EXPLICITLY written in the text \
below — nothing else.

Strict rules:
- Do NOT use any knowledge about this company from anywhere else. Only the text below exists to you.
- Do NOT infer, estimate, guess, or "fill in" a number or fact that isn't explicitly stated.
- Do NOT give any opinion, prediction, rating, price target, or buy/sell/hold view.
- Write every point in plain, simple English a complete beginner to investing could understand — \
explain any financial term you have to use (e.g. instead of just "EBITDA margin improved", say \
"EBITDA margin (a measure of how much profit the company keeps from its operations) improved").
- If the document is purely procedural (e.g. just a meeting notice with no real content), say so \
via has_material_info = false and leave key_points empty — do not manufacture points to fill space.
- If the text is garbled, cut off, or clearly incomplete, only use the parts that are actually \
readable and coherent."""


SUMMARIZER_INSTRUCTION = """You are writing an "AI Summary" section for a stock research app, read \
by ordinary retail investors who are NOT finance experts. You will be given a set of \
already-verified facts extracted from a company's REAL filings for one quarter (grouped by \
document type), and nothing else.

Your ONLY job is to weave those given facts into a clear, simple, easy-to-read summary.

Strict rules:
- Use ONLY the facts given to you below. Never add outside knowledge about this company, its \
sector, or the market. If the facts don't mention something, don't mention it either.
- Never give investment advice, a rating, a price target, or a buy/sell/hold opinion. Describe \
what happened — never what the reader should do about it.
- Write for a complete beginner: short sentences, everyday words, and briefly explain any \
financial term you use.
- If a section (announcements/concall/presentation) has no facts provided for it, set that \
section to null — do not invent content to avoid an empty field.
- Every entry in key_highlights must be a fact that actually appears in the input below, with the \
correct source_category and source_title copied from that fact's group."""


def format_fact_extraction_input(category: str, title: str, filed_date: str | None, text: str) -> str:
    return (
        f"Document type: {category}\n"
        f"Title: {title}\n"
        f"Filed on: {filed_date or 'unknown date'}\n\n"
        "--- DOCUMENT TEXT ---\n"
        f"{text}\n"
        "--- END DOCUMENT TEXT ---\n\n"
        "Extract only the real facts explicitly stated above, following your instructions exactly."
    )


def format_synthesis_input(
    company_name: str,
    symbol: str,
    quarter_label: str,
    facts_by_category: dict[str, list[dict]],
) -> str:
    lines = [
        f"Company: {company_name} ({symbol})",
        f"Quarter covered: {quarter_label}",
        "",
        "Below are verified facts already extracted from this company's real filings for this "
        "quarter, grouped by document type. Each fact is already simplified and traceable to a "
        "specific document.",
    ]
    for category in ("announcement", "concall", "presentation"):
        docs = facts_by_category.get(category) or []
        if not docs:
            lines.append(f"\n[{category.upper()}] — no readable documents this quarter.")
            continue
        lines.append(f"\n[{category.upper()}]")
        for doc in docs:
            lines.append(f"  Document: \"{doc['title']}\" ({doc.get('filed_date') or 'undated'})")
            for point in doc["key_points"]:
                lines.append(f"    - {point}")
    lines.append(
        "\nWrite the summary now, following your instructions exactly — use only the facts above."
    )
    return "\n".join(lines)
