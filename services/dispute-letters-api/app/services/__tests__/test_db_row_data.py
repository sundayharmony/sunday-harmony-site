"""Supabase maybe_single can return None from execute() — never crash on .data."""

from __future__ import annotations

from types import SimpleNamespace

from app.db import _row_data, get_letter


def test_row_data_handles_none_and_missing():
    assert _row_data(None) is None
    assert _row_data(SimpleNamespace(data=None)) is None
    assert _row_data(SimpleNamespace(data={"id": "x"})) == {"id": "x"}
    assert _row_data(SimpleNamespace()) is None
    assert _row_data(SimpleNamespace(data=["not", "a", "dict"])) is None


def test_get_letter_returns_none_when_execute_is_none(monkeypatch):
    class FakeQuery:
        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def maybe_single(self):
            return self

        def execute(self):
            return None

    class FakeClient:
        def table(self, _name):
            return FakeQuery()

    monkeypatch.setattr("app.db.get_supabase", lambda: FakeClient())
    assert get_letter("session", "letter") is None
