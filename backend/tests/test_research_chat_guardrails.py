"""
tests/test_research_chat_guardrails.py
Unit tests for the two guardrails that bracket every Research Chat answer, and
for the chunking that feeds retrieval.

Deliberately pure — no database, no network, no model. These are the parts
where a regression is silent: an over-eager scope gate refuses real market
questions and nobody notices until a user complains, and an under-eager advice
filter ships buy/sell language to production. Both are cheap to pin down here
and expensive to catch anywhere else.
"""

import pytest

from agents.research_chat import guardrails
from services.rag.chunking import normalise_text, split_text


# ── Scope gate: must not reject real market questions ───────────────────────
# The asymmetry matters more than the rejections do — a research tool that
# turns away valid questions is worse than one that occasionally answers a
# stray one, so this list is the more important of the two.
@pytest.mark.parametrize("question", [
    "What are the red flags in Reliance Industries?",
    "How exposed is PNC Infratech to cement prices?",
    "Why did the stock fall yesterday?",
    "What did management say about margins on the last call?",
    "Where do I create a custom ratio?",
    "Explain P/E to me",
    "Which sector benefits if the RBI cuts rates?",
    "Is the current ratio of 0.99 a problem?",
    "Compare HDFC Bank and ICICI Bank",
    "should i buy this stock",
])
def test_market_questions_are_never_gated(question):
    assert guardrails.is_clearly_off_topic(question) is False


@pytest.mark.parametrize("question", [
    "What's a good pasta recipe?",
    "Write me a python script to sort a list",
    "What is the capital of France?",
    "Tell me a joke",
    "What are the symptoms of the flu?",
])
def test_clearly_unrelated_questions_are_gated(question):
    assert guardrails.is_clearly_off_topic(question) is True


def test_mixed_question_with_a_market_signal_is_allowed_through():
    """One off-topic clause must not veto a question that is genuinely about
    markets — the model's own scope rule is the second layer for these."""
    assert guardrails.is_clearly_off_topic(
        "Is there a good pharma stock to research, and also what's the weather?"
    ) is False


@pytest.mark.parametrize("text", ["hi", "Hello", "  thanks!  ", "good morning"])
def test_greetings_are_recognised(text):
    assert guardrails.is_greeting(text) is True


def test_a_question_is_not_a_greeting():
    assert guardrails.is_greeting("hi, what is the P/E of Reliance?") is False


# ── Advice filter: must strip directives, must keep ordinary prose ──────────
@pytest.mark.parametrize("answer", [
    "Investors should buy this at current levels.",
    "I would recommend accumulating on dips.",
    "The target price of Rs 1,500 looks achievable.",
    "This is a good buy right now.",
    "You should sell before the results.",
    "Book your profits here.",
])
def test_advice_sentences_are_stripped(answer):
    cleaned, removed = guardrails.strip_advice(answer)
    assert removed >= 1
    assert not guardrails._ADVICE_PATTERNS.search(cleaned.replace(
        "recommendation was removed here", ""
    ))


@pytest.mark.parametrize("answer", [
    "The company buys nickel, which is 34% of its cost base.",
    "The board recommended a final dividend of Rs 5 per share.",
    "Management's stated target is 15% revenue growth.",
    "Sell-side coverage has broadened over the last year.",
    "Its P/E of 45 is high relative to its own five-year average.",
    "Buyback proceeds were returned to shareholders in March.",
])
def test_ordinary_research_prose_survives_untouched(answer):
    """The failure mode a naive banned-word list has: 'buy', 'sell', 'target'
    and 'recommend' all appear legitimately in research writing, and stripping
    those sentences would gut real answers."""
    cleaned, removed = guardrails.strip_advice(answer)
    assert removed == 0
    assert cleaned == answer


def test_stripping_preserves_the_rest_of_a_long_answer():
    answer = (
        "Revenue grew 12% year on year [1].\n"
        "- Margins compressed by 140 basis points [2].\n"
        "- Investors should buy this before the next quarter.\n"
        "Debt to equity stands at 0.42 [3]."
    )
    cleaned, removed = guardrails.strip_advice(answer)
    assert removed == 1
    assert "Revenue grew 12% year on year [1]." in cleaned
    assert "Debt to equity stands at 0.42 [3]." in cleaned
    assert "should buy" not in cleaned
    # The bullet marker survives, so the list does not visibly break.
    assert cleaned.count("- ") == 2


# ── Chunking ────────────────────────────────────────────────────────────────
def test_short_text_stays_one_chunk():
    """Structured records (a fundamentals sheet, a help topic) are only
    meaningful whole — splitting them is the bug this guards against."""
    assert len(split_text("A short company fact sheet.", max_chars=1400)) == 1


def test_long_text_splits_with_overlap_and_respects_the_cap():
    paragraphs = [f"Paragraph {i}. " + ("word " * 60) for i in range(30)]
    chunks = split_text("\n\n".join(paragraphs), max_chars=800, overlap_chars=120)

    assert len(chunks) > 1
    assert all(len(chunk) <= 800 + 120 for chunk in chunks), "no chunk may blow past the cap"
    assert all(chunk.strip() for chunk in chunks)


def test_a_single_unbroken_run_is_still_split():
    """A PDF page that extracts as one continuous run has no paragraph breaks
    at all — the sentence-then-hard-cut fallback has to handle it."""
    chunks = split_text("word " * 2000, max_chars=500, overlap_chars=50)
    assert len(chunks) > 1
    assert all(len(chunk) <= 550 for chunk in chunks)


def test_normalise_collapses_pdf_whitespace_but_keeps_paragraphs():
    messy = "Line   one\n  continued\n\n\n\nSecond   paragraph"
    assert normalise_text(messy) == "Line one\ncontinued\n\nSecond paragraph"
