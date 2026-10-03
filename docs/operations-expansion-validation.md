# Operations expansion — local validation

Updated 2026-10-01. Continued the existing uncommitted implementation.

## Implemented behavior

1. IP and supervisor attendance has no time-of-day gate. Existing assignment, business-date, Sunday approval, photo and report rules remain. Managers can filter both attendance tables and XLSX exports by IST time, including overnight ranges.
2. Dev can mark an account as City Ops and map supervisors. Operational access follows those mappings; no mappings means no job access. Global template and account administration remain separately privileged.
3. Superadmin and Dev can view all IP rosters; City Ops sees mapped supervisors. Manager grids omit jobs without an IP roster entry in the selected date range.
4. Supervisors can schedule themselves. Managers can schedule supervisors within their access scope, with date/job/slot and duplicate validation.
5. The job form loads customer details from an Odoo CRM lead ID and saves the lead reference. Normal job requirements still apply.
6. IP and supervisor uploads of a validated PDF mark that assigned checklist complete and bypass item filling and completion checks. Pasting a document URL does not grant completion. Web and Expo display the PDF completion state.
7. Dev can permanently remove accounts using an exact email/phone confirmation and reason. Account-owned attendance/mappings are deleted; historical jobs/documents remain unassigned, and removal is audited. Dev accounts cannot be removed.

## Validation

- Admin production build passed; lint has zero errors and one existing LocationPicker hook warning.
- Partner web production build and lint passed.
- Expo Android bundle export passed (not a device test).
- Backend suite: 251 passed, 11 failed, 6 skipped. Failure names are below; failures concern older report, slot, rate-card, checklist-report and roster test contracts.
- Focused operations, attendance windows, Dev administration, supervisor checklist, attendance export and roster export checks: 49 passed.
- New operations regressions cover CRM lookup/persistence and mapped creation, scoped job/roster reads, no-grant access, supervisor self-scheduling, IST time filtering, both PDF upload roles, URL reset, and account removal with retained roster history.
- Alembic generated PostgreSQL SQL successfully for 0010 -> 0013. This checks migration generation, not application to a live database.
- Root and partner frontend diffs pass whitespace checks.

## Runtime limitations

No database migration, deployment, real account deletion or live Odoo write was performed. CRM tests mock Odoo responses; live lookup and S3 upload remain unverified. No browser was connected, so interactive UI testing was unavailable. CodeRabbit is installed but signed out; authenticate with `coderabbit auth login` to run its review.

The partner frontend is a separate Git checkout/submodule; include its changed files when packaging this work. Migrations 0011, 0012 and 0013 must be applied before running the new backend against an existing database.

## Remaining backend failures

- `tests/test_document_automation_service.py::test_daily_report_fills_supplied_pdf_template`
- `tests/test_job_completion_contract.py::test_job_slot_rejects_bad_pairs_and_installation`
- `tests/test_job_rates.py::test_a_picked_rate_card_overrides_the_typed_type_and_rate`
- `tests/test_job_rates.py::test_editing_a_card_leaves_already_created_jobs_alone`
- `tests/test_job_rates.py::test_incentive_is_a_superadmin_only_field`
- `tests/test_job_rates.py::test_a_job_is_named_after_its_customer_and_maps_from_its_pin`
- `tests/test_job_rates.py::test_superadmin_must_choose_a_supervisor_for_the_job`
- `tests/test_job_type_documents.py::test_a_measurement_job_files_its_ism_checklist_as_the_report`
- `tests/test_roster.py::test_roster_uses_the_supervisor_mapping_and_syncs_the_job_ip`
- `tests/test_roster.py::test_the_grid_can_reassign_an_unstarted_job_and_deleting_the_job_clears_the_roster`
- `tests/test_roster_full_day.py::test_attendance_is_marked_once_in_the_first_half`
