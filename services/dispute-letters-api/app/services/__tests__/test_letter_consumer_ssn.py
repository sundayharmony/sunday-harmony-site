"""Full SSN is applied onto the consumer before letter generation."""

from __future__ import annotations

from app.models import ConsumerInfo, ParsedReport
from app.services.letter_consumer import apply_letter_consumer


def test_apply_letter_consumer_sets_full_ssn_and_last4():
    report = ParsedReport(consumer=ConsumerInfo(name="Jane", ssn_last4="0000"))
    apply_letter_consumer(report, consumer_ssn="123-45-6789", consumer_dob="January 15, 1988")
    assert report.consumer.ssn == "123456789"
    assert report.consumer.ssn_last4 == "6789"
    assert report.consumer.dob == "January 15, 1988"
