from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


BureauCode = Literal["TUC", "EXP", "EQF"]
ExtractionQuality = Literal["high", "medium", "low"]
LetterType = Literal["bureau_equifax", "bureau_experian", "bureau_transunion", "furnisher"]
RepairPriority = Literal["high", "medium", "low", "none"]


class BureauScores(BaseModel):
    tuc: int | None = None
    exp: int | None = None
    eqf: int | None = None


class CreditHealthSummary(BaseModel):
    scores: BureauScores = Field(default_factory=BureauScores)
    total_accounts: int = 0
    negative_count: int = 0
    collection_count: int = 0
    high_priority_count: int = 0
    repair_summary: str = ""
    recommended_actions: list[str] = Field(default_factory=list)


class ConsumerInfo(BaseModel):
    name: str = ""
    dob: str = ""
    ssn_last4: str = ""
    addresses: list[str] = Field(default_factory=list)


class Subscriber(BaseModel):
    name: str
    address_lines: list[str] = Field(default_factory=list)
    phone: str = ""


class Tradeline(BaseModel):
    id: str
    creditor: str
    account_tu: str = ""
    account_exp: str = ""
    account_eqf: str = ""
    account_type: str = ""
    status: str = ""
    balance: str = ""
    past_due: str = ""
    remarks: str = ""
    bureaus: list[BureauCode] = Field(default_factory=list)
    is_collection: bool = False
    selected: bool = False
    dispute_reason: str = ""
    analysis_notes: str = ""
    suggested_dispute_reason: str = ""
    dispute_bureaus: list[BureauCode] = Field(default_factory=list)
    dispute_furnisher: bool = True
    legal_flags: list[str] = Field(default_factory=list)
    repair_priority: RepairPriority = "none"
    item_category: str = ""


class ParsedReport(BaseModel):
    source: str = "cursor_agent"
    reference: str = ""
    report_date: str = ""
    analysis_summary: str = ""
    credit_health: CreditHealthSummary = Field(default_factory=CreditHealthSummary)
    consumer: ConsumerInfo = Field(default_factory=ConsumerInfo)
    tradelines: list[Tradeline] = Field(default_factory=list)
    subscribers: list[Subscriber] = Field(default_factory=list)
    file_type: str = ""
    ocr_used: bool = False
    extraction_quality: ExtractionQuality = "medium"


class ExtractedDocument(BaseModel):
    file_type: str
    raw_path: str
    text: str
    html: str | None = None
    page_count: int | None = None
    ocr_used: bool = False
    extraction_quality: ExtractionQuality = "medium"


class TradelineSelection(BaseModel):
    id: str
    selected: bool = True
    dispute_reason: str = ""


class DisputePlanRequest(BaseModel):
    session_id: str
    selections: list[TradelineSelection] = Field(default_factory=list)
    furnisher_address_overrides: dict[str, list[str]] = Field(default_factory=dict)


class LetterItem(BaseModel):
    tradeline_id: str
    creditor: str
    account_number: str
    bureau: str = ""
    status: str = ""
    balance: str = ""
    dispute_reason: str = ""


class LetterPlan(BaseModel):
    id: str
    letter_type: LetterType
    recipient_name: str
    recipient_lines: list[str]
    statute: str
    items: list[LetterItem] = Field(default_factory=list)
    missing_address: bool = False


class LetterPlanResponse(BaseModel):
    session_id: str
    plans: list[LetterPlan]


class GenerateLettersRequest(BaseModel):
    session_id: str
    plan_ids: list[str] | None = None


class GeneratedLetter(BaseModel):
    id: str
    plan_id: str
    title: str
    markdown: str
    file_path: str


class ReportSessionResponse(BaseModel):
    session_id: str
    report: ParsedReport


class TradelineUpdateRequest(BaseModel):
    tradelines: list[Tradeline]


class ReportHealthResponse(BaseModel):
    session_id: str
    credit_health: CreditHealthSummary
    tradelines_by_priority: list[Tradeline]
    consumer_name: str = ""
    report_date: str = ""
    source: str = ""
