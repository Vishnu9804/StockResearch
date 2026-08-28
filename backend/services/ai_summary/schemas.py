"""
services/ai_summary/schemas.py
Structured outputs for the two-stage AI Summary pipeline (see pipeline.py).

Two stages, two schemas, deliberately kept narrow:

  1. DocumentFacts    — cheap tier, ONE call per document. Purely extractive:
                        "what does this specific filing actually say", never
                        "what do you know about this company" — the schema
                        has no field that invites outside knowledge, which is
                        half of what keeps this feature grounded.

  2. QuarterSummaryResult — smart tier, ONE call per company, fed only the
                        stage-1 facts (already extractive, already small) —
                        never the raw PDF text. Every KeyHighlight cites the
                        specific filing it came from, which is what lets a
                        claim in the final summary be checked against a real
                        document instead of trusted on faith — the
                        traceability this feature needs given how badly a
                        confident-sounding wrong number could land with a
                        client's end users.
"""
from typing import Literal

from pydantic import BaseModel, Field


class DocumentFacts(BaseModel):
    has_material_info: bool = Field(
        description="True only if this document contains real, specific facts worth "
        "summarising (results, decisions, numbers, management commentary). False for "
        "purely procedural filings (e.g. a bare meeting-schedule notice with no content)."
    )
    key_points: list[str] = Field(
        default_factory=list,
        max_length=8,
        description="Each item is ONE self-contained factual statement taken DIRECTLY from "
        "the document text below — plain, simple English, include any specific numbers/dates "
        "the document states. Never infer, estimate, or add anything not explicitly written "
        "in the text. Empty list if has_material_info is False.",
    )


class KeyHighlight(BaseModel):
    text: str = Field(description="One specific, plain-language fact from the quarter, in simple words a beginner could understand.")
    source_category: Literal["announcement", "concall", "presentation"] = Field(
        description="Which type of document this fact came from."
    )
    source_title: str = Field(description="The exact title of the source document this fact came from.")


class QuarterSummaryResult(BaseModel):
    overview: str = Field(
        description="3-5 sentences, extremely simple everyday language (explain any financial "
        "term you use), giving a beginner investor the overall picture of what this company "
        "did/said this quarter based ONLY on the facts provided below. No jargon, no opinions, "
        "no price targets, no buy/sell/hold language."
    )
    announcements_summary: str | None = Field(
        default=None,
        description="2-4 simple sentences covering what the ANNOUNCEMENT documents said this "
        "quarter. Null if no announcement facts were provided.",
    )
    concall_summary: str | None = Field(
        default=None,
        description="2-4 simple sentences covering what management said on the CONCALL this "
        "quarter. Null if no concall facts were provided.",
    )
    presentation_summary: str | None = Field(
        default=None,
        description="2-4 simple sentences covering what the INVESTOR PRESENTATION showed this "
        "quarter. Null if no presentation facts were provided.",
    )
    key_highlights: list[KeyHighlight] = Field(
        default_factory=list,
        max_length=10,
        description="The most important individual facts from the quarter, each one traceable "
        "to a specific source document — pull these from the facts provided, do not invent new "
        "ones.",
    )
