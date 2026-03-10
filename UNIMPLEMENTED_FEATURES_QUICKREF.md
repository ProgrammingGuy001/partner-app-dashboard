# Quick Reference: Unimplemented Features & Available Data

## 🚨 BUGS TO FIX IMMEDIATELY

| Issue | File | Line | Problem | Fix |
|-------|------|------|---------|-----|
| BOM Status Path | `bomApi.js` | 26-30 | `/status/` != `/history/` | Change path segment |
| Missing Endpoint | `verificationApi.js` | 34 | `/verify_document` doesn't exist | Remove or implement |
| Wrong HTTP Method | `dashboardApi.js` | 171 | `GET` for state change | Use `PUT`/`POST` |

---

## ✨ QUICK WINS (Low Effort, High Impact)

### 1. Show Job History Timeline
```javascript
// USE THIS ENDPOINT (Currently NOT called):
GET /dashboard/jobs/{jobId}/history

// Returns:
[
  {
    "id": 1,
    "job_id": 123,
    "status": "created",
    "timestamp": "2024-02-23T10:00:00Z",
    "notes": "Created by admin"
  },
  {
    "id": 2,
    "job_id": 123,
    "status": "in_progress",
    "timestamp": "2024-02-23T11:00:00Z",
    "notes": "Job started"
  },
  // ... more entries
]

// UI: Display as timeline with status badges
```

**Effort:** 2 hours
**Code Location to Add:** `dashboardApi.js`
**UI Location:** Job detail screen

---

### 2. Add Location Navigation
```javascript
// Job object already has:
{
  "google_map_link": "https://maps.google.com/?q=..." // ← NOT DISPLAYED
}

// Just add a button:
<TouchableOpacity onPress={() => Linking.openURL(job.google_map_link)}>
  <Text>Get Directions</Text>
</TouchableOpacity>
```

**Effort:** 30 minutes
**Code Location:** Job card/detail component

---

### 3. Display Job Area/Scope
```javascript
// Job object already has:
{
  "area": 500,        // ← NOT DISPLAYED (sq.ft?)
  "size": 4500        // ← NOT DISPLAYED
}

// Just render it:
<Text>{job.area} sq.ft</Text>
```

**Effort:** 15 minutes
**Code Location:** Job card

---

### 4. Show Admin Feedback on Rejected Items
```javascript
// Checklist item status object already has:
{
  "is_approved": false,
  "admin_comment": "Please fix the connections" // ← NOT DISPLAYED
}

// Add to UI:
{!item.is_approved && item.admin_comment && (
  <View style={{borderLeftColor: 'red'}}>
    <Text style={{color: 'red'}}>Admin: {item.admin_comment}</Text>
  </View>
)}
```

**Effort:** 45 minutes
**Code Location:** Checklist item detail

---

### 5. Add Verification Status Badges
```javascript
// Job object already has:
{
  "start_otp_verified": true,    // ← NOT DISPLAYED
  "end_otp_verified": false      // ← NOT DISPLAYED
}

// Add icons:
{job.start_otp_verified && <Icon name="check-circle" color="green" />}
{job.end_otp_verified && <Icon name="check-circle" color="blue" />}
```

**Effort:** 30 minutes
**Code Location:** Job header

---

## 📚 MEDIUM EFFORT FEATURES

### 6. Job History Timeline (2-3 hours)
- Add `getJobHistory` function to `dashboardApi.js`
- Create `JobTimeline` component
- Call endpoint in job details screen

### 7. Evidence Document Gallery (3-4 hours)
```javascript
// Checklist item status already has:
{
  "document_link": "https://s3.../image.jpg" // ← NOT DISPLAYED
}

// Create gallery component showing document_link from each item
```

### 8. External Checklist Link (1 hour)
```javascript
// Job object already has:
{
  "checklist_link": "https://..." // ← NOT DISPLAYED
}

// Add button:
<TouchableOpacity onPress={() => Linking.openURL(job.checklist_link)}>
  <Text>View Checklist Guidelines</Text>
</TouchableOpacity>
```

---

## 🔒 SECURITY FEATURES (Requires Backend Changes)

### OTP Verification for Jobs
**Status:** ❌ Backend endpoint exists BUT not accessible to IP users

Endpoints Available (admin-only):
- `POST /jobs/{job_id}/request-start-otp`
- `POST /jobs/{job_id}/verify-start-otp`
- `POST /jobs/{job_id}/request-end-otp`
- `POST /jobs/{job_id}/verify-end-otp`

**To Enable:**
1. Expose endpoints in `/api/v1/jobs.py` for IP users
2. Add authorization checks to ensure IP can only verify their own jobs
3. Implement UI flow in mobile

**Impact:** Prevents fraudulent job completion claims

---

## 📊 DATA FIELDS ALREADY IN RESPONSES (Not Displayed)

### In Every Job Response:
- ✅ `area` - Job scope in sq.ft
- ✅ `size` - Alternative size measure
- ✅ `job_rate_id` - Job type reference
- ✅ `google_map_link` - Navigate to site
- ✅ `checklist_link` - External guidelines
- ✅ `start_otp_verified` - Customer verified start
- ✅ `end_otp_verified` - Customer verified completion
- ✅ `customer_id` - Customer profile link

### In Every Checklist Item Status:
- ✅ `document_link` - Evidence photos/docs
- ✅ `admin_comment` - Feedback on rejection
- ✅ `is_approved` - Approval status

### In User Profile:
- ✅ `is_id_verified` - ID verification status
- ✅ `verified_at` - When verification completed

---

## 🛠️ IMPLEMENTATION CHECKLIST

### Phase 1: Bug Fixes (1 day)
- [ ] Fix BOM status path in `bomApi.js`
- [ ] Remove/implement verification document upload
- [ ] Change job completion to PUT/POST

### Phase 2: Display Missing Fields (2 days)
- [ ] Add job.area to job cards
- [ ] Add "Get Directions" (google_map_link)
- [ ] Add "View Guidelines" (checklist_link)
- [ ] Show admin_comment on rejected items
- [ ] Add OTP verification badges

### Phase 3: Job History (1-2 days)
- [ ] Add getJobHistory to dashboardApi
- [ ] Create timeline component
- [ ] Display in job details

### Phase 4: Enhanced Features (3+ days)
- [ ] Evidence gallery (document_link)
- [ ] Personal statistics
- [ ] Advanced filtering
- [ ] OTP verification flow

---

## 📱 FILES TO MODIFY

### API Layer (`expo-mobile/src/api/`)
- `dashboardApi.js` - Add history endpoint
- `bomApi.js` - Fix path, add missing features
- `verificationApi.js` - Fix/remove verify_document
- Create new `analyticsApi.js` if needed

### UI Components (`expo-mobile/src/screens/` or similar)
- Job detail screen - Add timeline, fields, buttons
- Checklist item detail - Show admin comments
- Job card - Show area, OTP badges

### Hooks/Utilities
- Add loading states for new endpoints
- Add error handling for timeline

---

## 📋 API ENDPOINTS READY TO USE

### High-Value, Low-Effort Endpoints:
```
GET /dashboard/jobs/{id}/history
  ↳ Returns: Timeline of all status changes
  ↳ Effort: 2 hours UI work

GET /verification/status
  ↳ Already used, could show more fields (verified_at, is_id_verified)
  ↳ Effort: 30 mins UI work

GET /dashboard/jobs/{id}
  ↳ Already used, returns more fields than displayed
  ↳ Effort: 1-2 hours to show all fields
```

---

## 🎯 ROI RANKING (Effort vs. Impact)

| Rank | Feature | Effort | Impact | Code Files |
|------|---------|--------|--------|------------|
| 1 | Show job.area | 15 min | Medium | Job card component |
| 2 | "Get Directions" button | 30 min | Medium | Job detail screen |
| 3 | Admin feedback display | 45 min | High | Checklist item detail |
| 4 | Job history timeline | 2 hrs | High | dashboardApi, timeline component |
| 5 | Verification badges | 30 min | Low | Job header component |
| 6 | Evidence gallery | 3 hrs | High | New gallery component |
| 7 | Fix BOM path | 15 min | Critical | bomApi.js |
| 8 | Fix verification endpoint | 30 min | Critical | verificationApi.js |
| 9 | Fix job completion method | 15 min | Critical | dashboardApi.js |

**Recommendation:** Start with rank 7-9 (bug fixes), then 1-5 (quick wins)

