"""Check-in windows and the slot requirement, the two rules that gate a day's work."""
from datetime import datetime, time
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.schemas.job import validate_job_slot
from app.utils.attendance_policy import (
    ATTENDANCE_TIMEZONE,
    check_in_window,
    ensure_attendance_window_open,
)


def at(hour, minute):
    return datetime(2026, 8, 25, hour, minute, tzinfo=ATTENDANCE_TIMEZONE)


def test_installation_checks_in_until_1030_whatever_its_slot_says():
    assert check_in_window("installation", time(9, 0)) == (time(0, 0), time(10, 30))
    assert check_in_window(None, None) == (time(0, 0), time(10, 30))


def test_slotted_job_gets_thirty_minutes_from_its_start():
    assert check_in_window("measurement", time(14, 0)) == (time(14, 0), time(14, 30))


@pytest.mark.parametrize(
    "job_type,slot_start,now,opens",
    [
        ("installation", time(9, 0), at(10, 29), True),
        ("installation", time(9, 0), at(10, 31), False),
        ("measurement", time(14, 0), at(14, 30), True),
        ("measurement", time(14, 0), at(14, 31), False),
        ("measurement", time(14, 0), at(13, 59), False),
    ],
)
def test_check_in_window_enforced(job_type, slot_start, now, opens):
    with patch("app.utils.attendance_policy.now_ist", return_value=now):
        if opens:
            ensure_attendance_window_open("check_in", job_type=job_type, slot_start=slot_start)
        else:
            with pytest.raises(HTTPException):
                ensure_attendance_window_open("check_in", job_type=job_type, slot_start=slot_start)


def test_check_out_is_never_gated():
    with patch("app.utils.attendance_policy.now_ist", return_value=at(0, 1)):
        ensure_attendance_window_open("check_out", job_type="measurement", slot_start=time(14, 0))


def test_slot_required_except_installation_and_grn():
    validate_job_slot("installation", None, None)
    validate_job_slot("GRN", None, None)
    validate_job_slot("Site Readiness", time(9, 0), time(13, 0))
    for job_type in ("measurement", "site_validation", "site_readiness"):
        with pytest.raises(ValueError):
            validate_job_slot(job_type, None, None)
    with pytest.raises(ValueError):
        validate_job_slot("installation", time(9, 0), time(13, 0))
