"""What each job type has to file: a report per visit, and what closes the job.

Installation runs over many days, so its history is one Daily Installation Report per
visit, and closing it needs its own handover, project report and NCR. The single-visit
types — measurement, site readiness, site validation — file one report each, uploaded
by the IP at check-out, which is both the visit record and the closure document. That
report is a separate document from the job's checklist, which is filed on its own.
"""

INSTALLATION_CLOSURE_DOCUMENTS = ("handover", "ncr", "project_report")

# Job type -> the slot its one site report is filed under. A job has a single type,
# so a job never needs more than one of these.
SITE_REPORT_SLOTS = {
    "measurement": "measurement_report",
    "site_readiness": "readiness_report",
    "site_validation": "validation_report",
}

SITE_REPORT_LABELS = {
    "measurement_report": "Measurement Report",
    "readiness_report": "Site Readiness Report",
    "validation_report": "Site Validation Report",
}

CLOSURE_DOCUMENT_LABELS = {
    "handover": "Handover",
    "ncr": "NCR",
    "project_report": "Project Report",
    **SITE_REPORT_LABELS,
}


def normalize_job_type(job_type: str | None) -> str:
    """Rate cards carry display names ("Site Readiness"), jobs carry keys."""
    normalized = "_".join((job_type or "").strip().lower().replace("-", " ").split())
    return "measurement" if normalized == "site_measurement" else normalized


def job_type_label(job_type: str | None) -> str:
    """A job type as it reads inside a sentence: "site_validation" -> "Site Validation"."""
    normalized = normalize_job_type(job_type)
    return normalized.replace("_", " ").title() if normalized else "Site"


def site_report_slot(job_type: str | None) -> str | None:
    """The single-report slot for this job type, or None when it files the three."""
    return SITE_REPORT_SLOTS.get(normalize_job_type(job_type))


def closure_documents(job_type: str | None) -> tuple[str, ...]:
    """Document slots required to close a job of this type.

    Unknown and legacy types (including grn) keep the three-document rule they have
    always had — a new type shouldn't silently become closable with nothing on file.
    """
    slot = site_report_slot(job_type)
    return (slot,) if slot else INSTALLATION_CLOSURE_DOCUMENTS


def files_daily_installation_report(job_type: str | None) -> bool:
    """True when a visit is recorded by the generated Daily Installation Report."""
    return site_report_slot(job_type) is None


def document_label(slot: str) -> str:
    return CLOSURE_DOCUMENT_LABELS.get(slot, slot.replace("_", " ").title())


def describe_closure_documents(job_type: str | None) -> str:
    """Human list for error messages: 'Handover, NCR and Project Report'."""
    labels = [document_label(slot) for slot in closure_documents(job_type)]
    if len(labels) == 1:
        return labels[0]
    return f"{', '.join(labels[:-1])} and {labels[-1]}"


if __name__ == "__main__":
    assert closure_documents("installation") == INSTALLATION_CLOSURE_DOCUMENTS
    assert closure_documents(" Measurement ") == ("measurement_report",)
    assert closure_documents("site_readiness") == ("readiness_report",)
    assert closure_documents("Site Readiness") == ("readiness_report",)
    assert closure_documents(None) == INSTALLATION_CLOSURE_DOCUMENTS
    assert closure_documents("grn") == INSTALLATION_CLOSURE_DOCUMENTS
    assert files_daily_installation_report("installation")
    assert not files_daily_installation_report("site_validation")
    assert describe_closure_documents("measurement") == "Measurement Report"
    assert describe_closure_documents("installation") == "Handover, NCR and Project Report"
    assert job_type_label("site_validation") == "Site Validation"
    assert job_type_label(None) == "Site"
    print("job_documents self-check ok")
