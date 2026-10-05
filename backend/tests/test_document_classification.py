"""
tests/test_document_classification.py
Unit tests for services/document_sync.classify_document — which Documents-tab
section a filing lands in. Pure, no database. Every case is a real filing
description seen in company_documents.
"""

import pytest

CONCALL_CATEGORY = "Analysts/Institutional Investor Meet/Con. Call Updates"


@pytest.fixture
def classify():
    # Imported lazily for the same reason as tests/test_gta_client.py.
    from services.document_sync import classify_document
    return classify_document


@pytest.mark.parametrize("category, description, expected", [
    # Filed under the con-call category, but only transcripts are concalls.
    (CONCALL_CATEGORY, "Tata Consultancy Services Limited has informed the Exchange about Transcript", "concall"),
    (CONCALL_CATEGORY, "Transcript of the discussion on the Unaudited Financial Results of the Company for the quarter ended June 30, 2026", "concall"),
    (CONCALL_CATEGORY, "HDFC Bank Limited has informed the Exchange about Link of Recording", "concall-recording"),
    (CONCALL_CATEGORY, "Audio recording of the discussion on the unaudited financial results", "concall-recording"),
    (CONCALL_CATEGORY, "Tata Consultancy Services Limited has informed the Exchange about Schedule of meet", "announcement"),
    (CONCALL_CATEGORY, "Please note that the Company executives will be participating in the Institutional Investors' Meeting - UBS India Summit 2026", "announcement"),
    (CONCALL_CATEGORY, "A meeting of the Board of Directors of the Company is scheduled to be held on Friday, July 17, 2026", "announcement"),
    (CONCALL_CATEGORY, "HDFC Bank Limited has informed the Exchange about Presentation", "presentation"),
    # Shareholder meetings are not earnings calls.
    ("Shareholders meeting", "Max Healthcare Institute Limited has informed the Exchange about Transcript of 24th Annual General Meeting", "announcement"),
    ("Shareholders meeting", "V-Mart Retail Limited has informed the Exchange about Recording of 24th Annual General Meeting of the Company", "announcement"),
    # Presentations filed through corp-announcements.
    ("Investor Presentation", "Reliance Industries Limited has informed the Exchange about Investor Presentation", "presentation"),
    # Ratings — but not a rating agency's own unrelated filings, nor filings
    # that merely mention a rating.
    ("Credit Rating", "Sundram Fasteners Limited has informed the Exchange about Credit Rating", "credit-rating"),
    (None, "Rating assigned / reaffirmed by Acuite Rating and Research Limited.", "credit-rating"),
    (CONCALL_CATEGORY, "CARE Ratings Limited has informed the Exchange about Schedule of meet", "announcement"),
    (None, "Format of Initial Disclosure to be made by an entity identified as a Large Corporate.", "announcement"),
    (None, "Monitoring Agency Report for the quarter ended 30th September 2025 issued Care Ratings Limited", "announcement"),
    # Annual reports — not newspaper ads about them.
    (None, "Submission of Annual Report for the Financial Year 2024-25", "annual-report"),
    (None, "BOROSIL RENEWABLES LIMITED has informed the Exchange about Copy of Newspaper Publication relating to Annual Report", "announcement"),
    ("Outcome of Board Meeting", "Outcome of Board Meeting held on April 24, 2026", "announcement"),
])
def test_classify_document(classify, category, description, expected):
    assert classify(category, description) == expected


def test_stored_title_alone_classifies_like_a_fresh_fetch(classify):
    # Stored rows keep only the description; the reclassify script relies on
    # the exchange category not being needed for these.
    desc = "Sun Pharmaceutical Industries Limited has informed the Exchange about Schedule of meet"
    assert classify(None, desc) == classify(CONCALL_CATEGORY, desc) == "announcement"
