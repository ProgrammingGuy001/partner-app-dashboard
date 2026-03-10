# Mobile App - Backend API Coverage Analysis

## Executive Summary
- **Total Backend Endpoints:** 42
- **Implemented in Mobile:** 18 endpoints (~43%)
- **Unimplemented:** 24 endpoints (~57%)
- **Critical Issues:** 2 endpoint path mismatches + 1 missing endpoint
- **Available Data Fields Not Shown:** 12+ fields from existing responses

---

## 🔴 CRITICAL: Issues to Fix Immediately

### 1. BOM Status Update - PATH MISMATCH
**Mobile (bomApi.js:26):**
```javascript
PATCH /dashboard/bom/status/{soId}?status=...
```
**Backend (api/v1/bom.py:80):**
```python
PATCH /dashboard/bom/history/{so_id}/status
```
**Status:** ❌ WILL FAIL (404 error)
**Fix:** Change mobile path from `/status/` to `/history/`

---

### 2. Verification Document Upload - ENDPOINT MISSING
**Mobile (verificationApi.js:34):**
```javascript
POST /verification/verify_document
```
**Backend:** ❌ ENDPOINT NOT FOUND
**Status:** BROKEN
**Options:**
- Remove from mobile if not needed
- Implement endpoint if needed for ID/education documents

---

### 3. Job Completion - WRONG HTTP METHOD
**Current (dashboardApi.js):** `GET /dashboard/jobs/{jobId}/completed`
**Should be:** `PUT` or `POST` (GET should not change state)
**Status:** Works but violates REST principles

---

## 🟠 HIGH PRIORITY: Unimplemented Features

### A. Job History Timeline
**Endpoint:** `GET /dashboard/jobs/{job_id}/history` ✅ EXISTS
**Location:** app/routes/job.py, line 189 (NOT in v1/jobs.py)
**What it returns:**
```json
[
  {"id": 1, "job_id": 123, "status": "created", "timestamp": "2024-02-23T10:00:00", "notes": "Created by admin"},
  {"id": 2, "job_id": 123, "status": "in_progress", "timestamp": "2024-02-23T11:00:00", "notes": "Started"},
  {"id": 3, "job_id": 123, "status": "paused", "timestamp": "2024-02-23T13:00:00", "notes": "Weather delay"},
  {"id": 4, "job_id": 123, "status": "completed", "timestamp": "2024-02-24T16:00:00", "notes": "Completed successfully"}
]
```
**Mobile Use:** Show job progress timeline with status changes and notes
**Effort:** Low (endpoint fully ready)

---

### B. Customer OTP Verification (SECURITY CRITICAL)
**Admin-Only Endpoints Available (not in v1 routes for IP users):**

1. `POST /jobs/{job_id}/request-start-otp` → Response: `{success, message}`
2. `POST /jobs/{job_id}/verify-start-otp` → Request: `{otp, notes}` → Response: Job
3. `POST /jobs/{job_id}/request-end-otp` → Response: `{success, message}`
4. `POST /jobs/{job_id}/verify-end-otp` → Request: `{otp, notes}` → Response: Job

**Status:** ✅ Backend ready, but IP users can't access these endpoints
**Mobile Impact:** Currently no way to implement secure customer verification for job operations
**Recommendation:** Expose to IP users in /api/v1/jobs.py with proper checks

---

## 🟡 MEDIUM PRIORITY: Available Data Not Displayed

### Job Fields (in JobResponse, backend returns but mobile doesn't show):
| Field | Type | Use Case | Current |
|-------|------|----------|---------|
| `area` | int | Job scope (500 sq.ft) | ❌ Not shown |
| `size` | int | Alternative size field | ❌ Not shown |
| `job_rate_id` | FK | Job type category | ❌ Not shown |
| `google_map_link` | URL | Navigate to site | ❌ Not shown |
| `checklist_link` | URL | External guidelines | ❌ Not shown |
| `start_otp_verified` | bool | Verified start? | ❌ Not shown |
| `end_otp_verified` | bool | Verified completion? | ❌ Not shown |

### Checklist Item Status Fields (backend returns but UI ignores):
| Field | Type | Use Case | Current |
|-------|------|----------|---------|
| `document_link` | URL | Evidence photo/doc | ❌ Not shown |
| `admin_comment` | str | Admin feedback | ❌ Not shown |

### User Profile Fields (backend returns but UI ignores):
| Field | Type | Use Case | Current |
|-------|------|----------|---------|
| `verified_at` | datetime | When verified | ❌ Not shown |
| `is_id_verified` | bool | ID proof status | ❌ Not shown |

---

## 📋 IMPLEMENTATION ROADMAP

### Phase 1: Fix Critical Issues (1 day)
- [ ] Fix BOM status path: `/status/` → `/history/`
- [ ] Remove or implement `/verification/verify_document`
- [ ] Change job completion to PUT/POST

### Phase 2: Add Job History (2-3 days)
- [ ] Call GET /dashboard/jobs/{job_id}/history
- [ ] Display timeline component in job details
- [ ] Show status badges with timestamps

### Phase 3: Display Available Fields (3-4 days)
- [ ] Add job.area to job cards
- [ ] Add "Get Directions" button (google_map_link)
- [ ] Show "View Guidelines" link (checklist_link)
- [ ] Display admin feedback on rejected items
- [ ] Add verification badges (start/end OTP status)

### Phase 4: Enhanced Features (5+ days)
- [ ] OTP verification flow (requires backend changes)
- [ ] Evidence gallery (document_link)
- [ ] Personal statistics endpoint
- [ ] Advanced filtering/search

---

## 📊 ENDPOINT INVENTORY BY CATEGORY

### ✅ FULLY IMPLEMENTED IN MOBILE (18 endpoints)
**Authentication (7):**
- POST /auth/register
- POST /auth/login
- POST /auth/verify-otp
- POST /auth/resend-otp
- GET /auth/me
- POST /auth/logout
- POST /auth/refresh-token (partial)

**Verification (3):**
- GET /verification/status
- POST /verification/pan
- POST /verification/bank
- GET /verification/panel-access

**Jobs (4):**
- GET /dashboard/jobs
- GET /dashboard/jobs/{id}
- GET /dashboard/jobs/{id}/checklists
- GET /dashboard/jobs/{id}/progress

**BOM (3):**
- GET /dashboard/bom/{so}/{cabinet}
- POST /dashboard/bom/submit
- GET /dashboard/bom/history

**Checklists (4):**
- GET /dashboard/jobs/{id}/checklists/{id}/items
- PUT /dashboard/jobs/{id}/checklists/items/{id}/status
- POST /dashboard/jobs/{id}/upload

---

### ❌ UNIMPLEMENTED IN MOBILE (24 endpoints)

**Admin Job Management (13):**
- GET /jobs/lookup-so/{so_number} - Odoo lookup
- POST /jobs - Create job
- GET /jobs - List with filters
- PUT /jobs/{id} - Update
- DELETE /jobs/{id} - Delete
- GET /jobs/customers - Customer dropdown
- GET /jobs/job-rates - Rate catalog
- POST /jobs/{id}/request-start-otp ⭐
- POST /jobs/{id}/verify-start-otp ⭐
- POST /jobs/{id}/request-end-otp ⭐
- POST /jobs/{id}/verify-end-otp ⭐
- POST /jobs/{id}/start (legacy)
- POST /jobs/{id}/pause
- POST /jobs/{id}/finish (legacy)

**Job Details (2):**
- GET /dashboard/jobs/{id}/history ⭐
- PUT /jobs/{id}/checklists/items/{id}/approve

**Admin BOM (2):**
- POST /bom/submit
- PATCH /bom/history/{id}/status

**Admin Checklists (7):**
- POST /checklists
- GET /checklists
- PUT /checklists/{id}
- DELETE /checklists/{id}
- POST /checklists/items
- PUT /checklists/items/{id}
- DELETE /checklists/items/{id}

**Admin IP Management (5):**
- POST /admin/verify-ip/{phone}
- GET /admin/ips
- GET /admin/ips/approved
- POST /admin/ips/{id}/assign-admins
- GET /admin/ips/{id}/admins

**Analytics (3):**
- GET /analytics/payout
- GET /analytics/job-stages
- GET /analytics/ip-performance

---

## 🎯 TOP 5 QUICK WINS FOR MOBILE UX

1. **Job History Timeline** (2 hrs)
   - Endpoint ready: GET /dashboard/jobs/{id}/history
   - Just needs UI display component
   - Shows what happened to job & when

2. **Location Navigation** (1 hr)
   - Add: `google_map_link` field
   - Button: "Get Directions" 
   - Already in response, not displayed

3. **Job Scope/Area** (30 min)
   - Add: `area` field to job card
   - Shows sq.ft or unit count
   - Already in response, not displayed

4. **Admin Feedback Display** (1 hr)
   - Show: `admin_comment` when items rejected
   - Helps IP understand what to fix
   - Already in response, not displayed

5. **Verification Badges** (1 hr)
   - Show badges for `start_otp_verified` & `end_otp_verified`
   - Confirms customer verification happened
   - Already in response, not displayed

---

## ⚠️ NOTES FOR DEVELOPMENT

1. **Path Issues:** Mobile has path inconsistencies that will cause runtime errors
2. **HTTP Methods:** Some endpoints use wrong HTTP verbs (GET for mutations)
3. **Missing Features:** OTP verification flow not exposed to IP users in API layer
4. **Field Coverage:** Backend returns more data than UI displays—low-hanging fruit
5. **Admin vs IP:** Backend clearly separates admin and IP routes; mobile only uses IP routes

---

