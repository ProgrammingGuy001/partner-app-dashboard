const fs = require("node:fs");

let content = fs.readFileSync(
  "partnerfrontend/src/ {4}onents/dashboard/DailyAttendance.jsx",
  "utf8",
);

// 1. Add Modal import
if (!content.includes("import Modal from '@components/common/Modal';")) {
  content = content.replace(
    "import DailyReportForm from './DailyReportForm';",
    "import DailyReportForm from './DailyReportForm';\nimport Modal from '@components/common/Modal';",
  );
}
if (!content.includes("import { nextSundayISO }")) {
  content = content.replace(
    "const todayISO = () => {",
    "const nextSundayISO = () => {\n  const d = new Date();\n  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));\n  const month = String(d.getMonth() + 1).padStart(2, '0');\n  const day = String(d.getDate()).padStart(2, '0');\n  return `${d.getFullYear()}-${month}-${day}`;\n};\n\nconst todayISO = () => {",
  );
}

// 2. Add state variables inside DailyAttendance
content = content.replace(
  "const [sundaySubmitting, setSundaySubmitting] = useState(false);",
  "const [sundaySubmitting, setSundaySubmitting] = useState(false);\n  const [sundayModalVisible, setSundayModalVisible] = useState(false);\n  const [sundayRequests, setSundayRequests] = useState([]);\n  const [requestDate, setRequestDate] = useState(nextSundayISO());",
);

// 3. Add fetchSundayRequests method inside DailyAttendance
content = content.replace(
  "const { mutateAsync: record, isPending } = useRecordAttendance();",
  "const { mutateAsync: record, isPending } = useRecordAttendance();\n\n  const fetchSundayRequests = async () => {\n    try {\n      const existing = await dashboardApi.getSundayRequests();\n      setSundayRequests(existing || []);\n    } catch (err) {\n      toast.error('Failed to load Sunday requests');\n    }\n  };",
);

// 4. Update submitSundayRequest logic
content = content.replace(
  /const submitSundayRequest = async \(\) => {[\s\S]*?setSundaySubmitting\(false\);\n}\n};/,
  `const submitSundayRequest = async (isModal = false) => {
    setSundaySubmitting(true);
    try {
      const created = await dashboardApi.createSundayRequest({
        requestDate: isModal ? requestDate : todayISO(),
        reason: sundayReason,
      });
      if (!isModal) {
        setSundayRequest(created);
      }
      setSundayReason('');
      toast.success('Request sent for superadmin approval');
      if (isModal) {
        fetchSundayRequests();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit Sunday work request');
    } finally {
      setSundaySubmitting(false);
    }
  };`,
);

// 5. Add "Manage Sunday Work Requests" button
content = content.replace(
  /(<form onSubmit=\{handleSubmit\} className="space-y-4 mb-6">)/,
  `<div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setRequestDate(nextSundayISO());
            fetchSundayRequests();
            setSundayModalVisible(true);
          }}
          className="w-full flex items-center justify-between rounded-lg border border-border bg-background p-3 hover:bg-surface transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Manage Sunday Work Requests</span>
          </div>
        </button>
      </div>
      $1`,
);

// 6. Add Modal at the bottom
content = content.replace(
  /(<\/Card>)/,
  `      <Modal isOpen={sundayModalVisible} onClose={() => setSundayModalVisible(false)} title="Sunday Work Requests">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Request Date (YYYY-MM-DD)</label>
            <input
              type="text"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <label className="text-sm font-semibold text-foreground block">Reason</label>
            <textarea
              value={sundayReason}
              onChange={(e) => setSundayReason(e.target.value)}
              placeholder="Reason (optional)"
              maxLength={500}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <Button type="button" disabled={sundaySubmitting} onClick={() => submitSundayRequest(true)} className="w-full">
              {sundaySubmitting ? 'Sending...' : 'Request Sunday work'}
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Previous Requests</h4>
            {sundayRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests found.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {sundayRequests.map((req) => (
                  <div key={req.id} className="rounded-lg border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{req.request_date}</span>
                      <span className={\`text-xs font-bold \${req.status === 'approved' ? 'text-green-600' : req.status === 'rejected' ? 'text-destructive' : 'text-orange-500'}\`}>
                        {req.status.toUpperCase()}
                      </span>
                    </div>
                    {req.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {req.reason}</p>}
                    {req.review_notes && <p className="text-xs text-muted-foreground mt-1">Notes: {req.review_notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    $1`,
);

fs.writeFileSync(
  "partnerfrontend/src/components/dashboard/DailyAttendance.jsx",
  content,
);
