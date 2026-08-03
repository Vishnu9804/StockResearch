"""services/rag/schemas.py
The contract between a source (services/rag/sources/*) and the indexer.

A source's only job is to produce RagSourceDocument objects. It never touches
the database, never embeds anything and never decides whether re-indexing is
needed — that keeps "where does this text come from" and "how does text become
a searchable vector" independently testable, and means adding a corpus is one
new file under sources/ plus one line in the worker.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Final


class SourceType:
    """The corpora. Kept as plain string constants rather than an Enum because
    they are stored as text in rag_documents.source_type and compared against
    values coming back from SQL — an Enum would add a conversion at every
    boundary and buy nothing."""

    COMPANY_PROFILE: Final = "COMPANY_PROFILE"
    COMPANY_FUNDAMENTALS: Final = "COMPANY_FUNDAMENTALS"
    TRANSCRIPT: Final = "TRANSCRIPT"
    NEWS: Final = "NEWS"
    PLATFORM_HELP: Final = "PLATFORM_HELP"

    ALL: Final = (COMPANY_PROFILE, COMPANY_FUNDAMENTALS, TRANSCRIPT, NEWS, PLATFORM_HELP)


# How each corpus is described to the user in a citation, and to the model in
# the context block it reads. The model uses this to weigh sources against each
# other — "management said X on a call" and "a newspaper reported X" are
# different kinds of evidence and the answer should be able to say which.
SOURCE_LABELS: Final[dict[str, str]] = {
    SourceType.COMPANY_PROFILE: "Company exposure profile",
    SourceType.COMPANY_FUNDAMENTALS: "Company fundamentals",
    SourceType.TRANSCRIPT: "Earnings call transcript",
    SourceType.NEWS: "News article",
    SourceType.PLATFORM_HELP: "FinScreen help",
}


@dataclass(slots=True)
class RagSourceDocument:
    """One real-world object, rendered to plain text and ready to index."""

    source_type: str
    # Stable within source_type — re-indexing the same object MUST produce the
    # same key, so it is always derived from identity (symbol, news uuid,
    # transcript URL) and never from a timestamp.
    source_key: str
    title: str
    text: str

    symbol: str | None = None
    url: str | None = None
    doc_date: datetime | None = None
    metadata: dict = field(default_factory=dict)

    # Set when the source has already split the text itself along boundaries
    # only it knows about (e.g. a company profile's one-section-per-fact
    # layout). None means "let services/rag/chunking.py decide".
    pre_chunked: list[str] | None = None
