# Partner platform review — 18 September 2026

Changes are local and have not been deployed. Existing uncommitted work was preserved.

## How the application works

| Surface | Responsibility and main journey |
| --- | --- |
| `app` | FastAPI, SQLAlchemy/PostgreSQL, separate admin and partner cookies, OTP/password authentication, verification, job ownership, attendance/roster rules, approval queues, files, billing and Odoo integration. |
| `admin_dashboard` | React/Vite admin portal: sign in, manage workers and jobs, schedule visits, review evidence, generate documents and submit/approve financial requests according to role. React Query handles server state. |
| `partnerfrontend` | React/Vite partner portal: register, sign in by OTP, complete verification, see assignments, mark attendance, file reports/checklists and request materials or billing. React Query and Zustand hold client state. |

Traced shared authentication, job-edit, document-upload and API-error paths before editing. Existing job ownership, verification, role restrictions and approval boundaries remain in place. Shared backend changes also affect mobile clients; no mobile UI changes were made.

## Fixes implemented in this review

| Area | Change and user impact |
| --- | --- |
| Server-side URL fetching | Checklist exports fetch photos only from the configured S3 bucket over HTTPS, with redirects disabled. Untrusted links remain links instead of becoming server network requests. Decoded images are capped at 25MP. |
| Upload validation | Reject empty files, mismatched PDF/image/legacy Word signatures and invalid DOCX/XLSX containers. Set recognized MIME types from the validated format. This is format validation, not antivirus scanning. |
| OTP concurrency | Row locks serialize verification of login, job-start and job-end OTPs. Concurrent requests cannot consume one OTP twice or lose failed-attempt increments. |
| Registration | Added a five-per-minute limit using the existing limiter. Its existing storage is process-local; distributed enforcement still requires a shared store or gateway. |
| Shared devices | Admin sign-in cancels old requests and clears cached account data. API responses use `no-store` and `nosniff`. |
| Phone entry | Registration, login and OTP validation now share normalization. Ten-digit numbers starting with `91` work correctly, and web users can paste a number with `+91` and spaces. |
| Upload responsiveness | All asynchronous S3 upload routes use the existing thread pool instead of blocking the API event loop with boto3. Database operations still use the existing synchronous ORM. |
| Retries | Reduced admin transport read retries from three to one because React Query already retries reads. Verified that failed writes are not replayed. Partner timeout/network messages explain that a save may already have succeeded. |
| Admin dashboard | Added direct job/schedule/attendance actions. Failed sources are named with a retry button; available sections stay visible. Missing data no longer appears as zero counts or “All Caught Up.” Counts identify the 100-job overview limit, and “In Progress” excludes unstarted jobs. |
| Partner dashboard | Added retry beside cached-data warnings, a clear-search action and a next step when no assignments are shown. File removal is disabled while upload controls are disabled. |
| Validation and login help | Admin forms show short, sanitized business-validation messages. Removed dead legal links from admin login and replaced “ask a dev” with administrator guidance. |
| Legacy job edits | Sales-order and other unrelated edits no longer fail because an old job lacks an attendance slot. Explicit slot/type/rate-card edits still validate the merged schedule. |

Existing uncommitted changes also included refresh-token uniqueness/atomic consumption, cookie-origin checks, safer Odoo retries, session-cache cleanup, route splitting and partner OTP/modal improvements. These were retained; they are not all new work from this review.

The URL-fetch and file-validation changes follow [OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) and [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## Business-flow changes — follow-up review

The partner's main journey is now **account setup → today's job → check in → checklist/work → report and check out → final job completion when all work is done**. Daily checkout and final job closure are separate actions. Existing approval, ownership, OTP, Sunday-work and document requirements remain enforced by the backend.

| Previous friction | Implemented change |
| --- | --- |
| Identity documents described as optional educational certificates; skipping or continuing led back to verification. | Identity upload is required in partner setup. Persisted submission and administrator approval have separate states. Refreshing approval updates the authenticated profile so approved partners can enter their jobs. |
| Admins could approve identity without seeing uploaded evidence in the confirmation dialog. | The approval dialog loads document links on demand. The new read endpoint enforces the same supervisor mapping or superadmin access as approval. The existing manual verification route remains available when no document exists. |
| Navigation showed work pages that unapproved partners could not enter. | Setup-only navigation until approval, then plain-language labels for daily work, schedules, materials, deliveries and report copies. Login keeps the number already entered at registration. |
| “Submit daily report” opened a download-only generator. | Today's card opens checkout directly. Installation partners fill and file the existing report form during checkout; site measurement/readiness/validation retain their required file upload. The standalone generator clearly says it downloads a copy only. |
| Partners selected the assignment and check-in/check-out again, including the wrong half of a full-day job. | Assignment links retain context, full-day entries resolve to the first slot, the existing visit status determines the action, and site location is prefilled and editable. A missing linked assignment is explained instead of falling back to another job. |
| Too many report fields visible at once. | The required work summary stays visible; optional detailed work, manpower and photos expand when needed. No required server fields were removed. |
| Installation schedule could say “missed” while the attendance API still accepted check-in until 10:30. | Schedule status and submission now use the same existing check-in-window function. Six regression cases cover installation and slotted-job boundaries. |
| Final job completion dominated the partner job page. | Daily visit and checklist actions come first. Final closure is a separate collapsed section, with document prerequisites and six-digit customer codes. Customer completion codes cannot be requested before documents are attached. |
| Admin job workspace showed start prerequisites even for active or completed jobs; fetch errors looked like missing checklists/reports. | Next actions follow job stage. Assigning a partner opens the existing edit form in place. Loading and failed reads have explicit states and retries. The edit form and map load only when opened. |

Additional fixes: camera and Sunday-request buttons now pass the intended arguments instead of click events. Schedule entries link directly to the appropriate visit or job. Material and delivery screen headings match their navigation labels; their underlying submission workflows were retained.

This pass covers account setup/approval, scheduling, daily visits/reports, and final job completion. It does not certify every purchasing, Odoo synchronization, invoice or payout scenario. No production data was changed and no real notifications were sent.

## Verification

- Admin and partner production builds passed. Both still report a main JavaScript chunk above 500 kB; bundle size and device-level speed are not certified by this review.
- Partner lint passed. Admin lint has no errors and one existing `LocationPicker.tsx` hook-dependency warning.
- Offline backend checks: **90 passed, 6 skipped** using `app/venv/bin/python -m pytest -q app tests/test_cookie_security.py tests/test_upload_service.py tests/test_session_safety.py`. The six PostgreSQL-only cases skip without an explicitly supplied disposable database.
- Six OTP concurrency cases passed separately against an isolated PostgreSQL 18 instance, covering correct and incorrect concurrent attempts for all three OTP purposes. The temporary server was stopped afterward.
- `node tests/check_web_sessions.mjs` passed for both clients: one refresh for parallel expiry responses, no script-readable browser tokens, preserved session during network failure, phone normalization and no mutation replay.
- `node tests/check_dashboard_states.mjs` passed: rendered empty/error/partial-data states and safe validation messages. This is server rendering, not browser interaction or visual QA.
- `node tests/check_business_flows.mjs` passed: pending versus approved setup, restricted navigation, full-day visit selection, missing assignments, report-type branching, actual multipart report serialization, final-closure hierarchy, and admin stage/error states. Uses offline server rendering and a stubbed HTTP adapter.
- Both `npm audit --omit=dev` runs reported zero vulnerabilities.
- Python requirements audit reported one unique unpatched advisory, CVE-2024-23342, for transitive `ecdsa` (listed twice by the scanner). Effective local signing is HS256 and the selected EC backend is `cryptography`, so the affected pure-Python ECDSA signing path is not used by the inspected JWT configuration. This is not a clean dependency audit or a verification of production settings. See the [upstream advisory discussion](https://github.com/tlsfuzzer/python-ecdsa/issues/352).

## Remaining verification and known limits

The baseline full suite had 193 passes and 16 failures. The final full suite has **226 passed, 14 failed, 6 skipped**. Two failures were fixed by the legacy-edit correction. Fourteen pre-existing failures remain in these contract groups:

- A removed daily-report helper and a removed measurement-report checklist helper.
- Older attendance cutoff wording/behavior and an obsolete `slot_end` argument.
- Fixtures that create slotted job types without required attendance slots.
- Older roster tests passing a removed `background_tasks` argument.

These tests need reconciliation with current product contracts; the runtime rules were not weakened to satisfy old expectations.

No browser was connected (checked again during the business-flow pass), and CodeRabbit was installed but signed out. Visual, keyboard, small-screen and real-device testing remain pending. Live Odoo writes, SMS delivery, KYC calls, S3 permissions, deployment and load testing were not exercised. No real notifications or financial records were created.

Access tokens retain the existing expiry-based revocation behavior: revoking refresh tokens does not immediately invalidate an already issued access JWT. OTP generation/resend ordering and refresh-token coordination across separate browser tabs were not covered by the concurrency tests above.

Before release, reconcile the remaining contract tests and run browser acceptance tests for registration, sign-in, verification, attendance/report upload, job completion, material requests and admin approvals. Revalidate external-service permissions and deployed configuration separately.
