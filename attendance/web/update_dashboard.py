from pathlib import Path

p = Path("src/pages/Dashboard.tsx")
s = p.read_text(encoding="utf-8")

original = s

# 1. Import existing approval API functions
s = s.replace(
    "import { getLeaves } from '../api/leaves';",
    "import { getLeaves, approveLeave, rejectLeave } from '../api/leaves';"
)
s = s.replace(
    "import { getPermissions } from '../api/permissions';",
    "import { getPermissions, approvePermission, rejectPermission } from '../api/permissions';"
)

# 2. Load all requests so older pending requests are not missed
s = s.replace(
    "setLeaveRequests(leaveData.slice(0, 5));\n    setPermissionRequests(permissionData.slice(0, 5));",
    "setLeaveRequests(leaveData);\n    setPermissionRequests(permissionData);"
)

# 3. Add action handlers before fetchRequestId
marker = " const fetchRequestId = useRef(0);"
handlers = r'''
 const [actionLoading, setActionLoading] = useState<string | null>(null);
 const [actionMessage, setActionMessage] = useState("");
 const [actionError, setActionError] = useState("");

 const handleApproveRequest = async (type: "leave" | "permission", id: number) => {
   const key = `${type}-${id}`;
   try {
     setActionLoading(key);
     setActionMessage("");
     setActionError("");

     if (type === "leave") {
       await approveLeave(id);
     } else {
       await approvePermission(id);
     }

     setActionMessage(`${type === "leave" ? "Leave" : "Permission"} request approved.`);
     await fetchLeavePermissionUpdates();
   } catch (err: any) {
     setActionError(
       err?.response?.data?.detail ||
       err?.response?.data?.error ||
       `Unable to approve ${type} request.`
     );
   } finally {
     setActionLoading(null);
   }
 };

 const handleRejectRequest = async (type: "leave" | "permission", id: number) => {
   const reason = window.prompt("Enter rejection reason:");
   if (!reason || !reason.trim()) return;

   const key = `${type}-${id}`;
   try {
     setActionLoading(key);
     setActionMessage("");
     setActionError("");

     if (type === "leave") {
       await rejectLeave(id, reason.trim());
     } else {
       await rejectPermission(id, reason.trim());
     }

     setActionMessage(`${type === "leave" ? "Leave" : "Permission"} request rejected.`);
     await fetchLeavePermissionUpdates();
   } catch (err: any) {
     setActionError(
       err?.response?.data?.detail ||
       err?.response?.data?.error ||
       `Unable to reject ${type} request.`
     );
   } finally {
     setActionLoading(null);
   }
 };
'''
if marker not in s:
    raise SystemExit("STOP: fetchRequestId marker not found. No file saved.")
if "const handleApproveRequest" not in s:
    s = s.replace(marker, handlers + "\n" + marker, 1)

# 4. Prepare combined pending approval list
marker = next((line for line in s.splitlines() if "const trendDate=" in line), None)
pending_logic = r'''
  const pendingApprovals = [
    ...leaveRequests
      .filter((item) => String(item.status || "").toUpperCase() === "PENDING")
      .map((item) => ({
        id: item.id,
        type: "leave" as const,
        employeeName: item.employee_name || "Employee",
        employeeId: item.employee_id || "--",
        dateLabel: `${item.start_date}  ${item.end_date}`,
        category: item.leave_type || "Leave",
        reason: item.reason || "No reason provided",
      })),
    ...permissionRequests
      .filter((item) => String(item.status || "").toUpperCase() === "PENDING")
      .map((item) => ({
        id: item.id,
        type: "permission" as const,
        employeeName: item.employee_name || "Employee",
        employeeId: item.employee_id || "--",
        dateLabel: item.date,
        category: `Permission${item.duration_minutes ? `  ${item.duration_minutes} min` : ""}`,
        reason: item.reason || "No reason provided",
      })),
  ];
'''
if marker not in s:
    raise SystemExit("STOP: trendDate marker not found. No file saved.")
if "const pendingApprovals = [" not in s:
    s = s.replace(marker, marker + "\n" + pending_logic, 1)

# 5. Add styles for approval actions
style_marker = ".request-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase}"
styles = r'''
.approval-panel{background:#fff;border:1px solid #DDEAE1;border-radius:18px;box-shadow:0 5px 18px rgba(15,36,24,.045);overflow:hidden;margin-bottom:16px}
.approval-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:17px 21px;border-bottom:1px solid #EDF2EE}
.approval-row:last-child{border-bottom:0}
.approval-main{min-width:0;flex:1}
.approval-details{font-size:11px;color:#718078;margin-top:5px;line-height:1.6;overflow-wrap:anywhere}
.approval-actions{display:flex;gap:8px;flex-shrink:0}
.approval-btn{border:0;border-radius:8px;padding:9px 12px;font-size:11px;font-weight:800;cursor:pointer}
.approval-btn:disabled{opacity:.55;cursor:not-allowed}
.approval-approve{background:#EAF7EE;color:#15803D}
.approval-reject{background:#FEF2F2;color:#DC2626}
.approval-feedback{padding:10px 21px;font-size:12px;font-weight:700}
.approval-success{color:#15803D}
.approval-error{color:#DC2626}
@media(max-width:600px){.approval-row{flex-direction:column}.approval-actions{width:100%}.approval-btn{flex:1}}
'''
if style_marker not in s:
    raise SystemExit("STOP: request-status CSS marker not found. No file saved.")
if ".approval-panel{" not in s:
    s = s.replace(style_marker, style_marker + styles, 1)

# 6. Keep the three top request sections to five recent items each
s = s.replace(
    ") : leaveRequests.map((leave) => {",
    ") : leaveRequests.slice(0, 5).map((leave) => {"
)
s = s.replace(
    ") : permissionRequests.map((permission) => {",
    ") : permissionRequests.slice(0, 5).map((permission) => {"
)

# 7. Move analytics below request updates and recent attendance
analytics_start_marker = '   <div className="grid">\n    <div className="card chart">'
requests_marker = '    <div className="request-grid">'
recent_marker = '   <div className="card wide" style={{gridColumn:"span 12",padding:21}}'
fragment_end_marker = '\n  </>}'

if analytics_start_marker not in s:
    raise SystemExit("STOP: analytics start marker not found. No file saved.")
analytics_start = s.index(analytics_start_marker)
requests_start = s.index(requests_marker, analytics_start)
recent_start = s.index(recent_marker, requests_start)
fragment_end = s.index(fragment_end_marker, recent_start)

analytics_block = s[analytics_start:requests_start]
recent_block = s[recent_start:fragment_end]

# Remove analytics from its current position
s = s[:analytics_start] + s[requests_start:]

# Find the recent-attendance block after removal
recent_start = s.index(recent_marker, analytics_start)
fragment_end = s.index(fragment_end_marker, recent_start)

approval_block = r'''
    <div className="approval-panel">
      <div className="request-head">
        <div>
          <div className="request-title">Pending Approvals</div>
          <div className="request-sub">Review employee leave and permission requests awaiting a decision</div>
        </div>
        <span className="request-status" style={{color:"#D97706",background:"#D9770612"}}>
          {pendingApprovals.length} Pending
        </span>
      </div>

      {actionMessage && <div className="approval-feedback approval-success">{actionMessage}</div>}
      {actionError && <div className="approval-feedback approval-error">{actionError}</div>}

      {!pendingApprovals.length ? (
        <div className="request-empty">No pending approvals. All requests are up to date.</div>
      ) : pendingApprovals.map((item) => {
        const key = `${item.type}-${item.id}`;
        return (
          <div className="approval-row" key={key}>
            <div className="approval-main">
              <div className="request-employee">
                <div className="avatar">{item.employeeName[0]?.toUpperCase() || "E"}</div>
                <div className="request-info">
                  <div className="request-name">{item.employeeName}</div>
                  <div className="request-meta">{item.employeeId}  {item.category}</div>
                </div>
              </div>
              <div className="approval-details">
                <div><strong>Date:</strong> {item.dateLabel}</div>
                <div><strong>Reason:</strong> {item.reason}</div>
              </div>
            </div>
            <div className="approval-actions">
              <button
                type="button"
                className="approval-btn approval-approve"
                disabled={actionLoading !== null}
                onClick={() => handleApproveRequest(item.type, item.id)}
              >
                {actionLoading === key ? "Processing..." : "Approve"}
              </button>
              <button
                type="button"
                className="approval-btn approval-reject"
                disabled={actionLoading !== null}
                onClick={() => handleRejectRequest(item.type, item.id)}
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
'''

# Put pending approvals after Recent Attendance and analytics after approvals
s = (
    s[:fragment_end]
    + "\n"
    + approval_block
    + "\n"
    + analytics_block
    + s[fragment_end:]
)

if s == original:
    raise SystemExit("STOP: No changes were made.")
p.write_text(s, encoding="utf-8")
print("SUCCESS: Dashboard.tsx updated.")
print("Backup: Dashboard.tsx.before-pending-approvals.bak")


