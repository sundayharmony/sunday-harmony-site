from __future__ import annotations

import re


def apply_letter_consumer(
    report,
    *,
    consumer_name: str | None = None,
    consumer_addresses: list[str] | None = None,
    consumer_ssn: str | None = None,
    consumer_dob: str | None = None,
):
    """Apply staff/intake identity overrides onto the in-memory report consumer."""
    if consumer_name is not None and consumer_name.strip():
        report.consumer.name = consumer_name.strip()
    if consumer_addresses is not None:
        report.consumer.addresses = [
            a.strip() for a in consumer_addresses if a and str(a).strip()
        ]
    if consumer_ssn is not None and str(consumer_ssn).strip():
        digits = re.sub(r"\D", "", str(consumer_ssn).strip())
        report.consumer.ssn = digits or str(consumer_ssn).strip()
        if len(digits) >= 4:
            report.consumer.ssn_last4 = digits[-4:]
    if consumer_dob is not None and str(consumer_dob).strip():
        report.consumer.dob = str(consumer_dob).strip()
    return report
