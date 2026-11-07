"""Isolated live-testability: plan-from-report needs no session DB."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.models import ParsedReport, Tradeline, TradelineSelection
from app.services.credit_health import enrich_tradeline


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DISPUTE_LETTERS_API_SECRET", "live-test-secret")
    # Import after env so verify_internal_secret sees the secret at request time.
    from app.main import app

    return TestClient(app)


def test_plan_from_report_round1_inconsistency_requires_auth(client: TestClient):
    tl = enrich_tradeline(
        Tradeline(
            id="tl-a",
            creditor="BANK",
            account_tu="****1111",
            account_exp="****1111",
            account_eqf="****1111",
            status="Open",
            bureaus=["EQF", "EXP", "TUC"],
            payment_history="EQF:30:2020-01;EXP:OK;TUC:OK",
            selected=True,
        )
    )
    body = {
        "session_id": "inline-live",
        "round_number": 1,
        "report": ParsedReport(tradelines=[tl]).model_dump(),
        "selections": [TradelineSelection(id=tl.id, selected=True).model_dump()],
    }
    denied = client.post("/internal/disputes/plan-from-report", json=body)
    assert denied.status_code == 401

    ok = client.post(
        "/internal/disputes/plan-from-report",
        json=body,
        headers={"Authorization": "Bearer live-test-secret"},
    )
    assert ok.status_code == 200
    data = ok.json()
    assert data["session_id"] == "inline-live"
    plans = data["plans"]
    bureau_types = {p["letter_type"] for p in plans if p["letter_type"].startswith("bureau_")}
    assert bureau_types == {"bureau_equifax", "bureau_experian", "bureau_transunion"}
    reasons = [
        item["dispute_reason"].lower()
        for p in plans
        if p["letter_type"].startswith("bureau_")
        for item in p["items"]
    ]
    assert reasons
    assert all("inconsistent" in r for r in reasons)
