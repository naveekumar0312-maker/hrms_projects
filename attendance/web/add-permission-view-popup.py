from pathlib import Path
from datetime import datetime

p = Path("src/pages/Permissions.tsx")
s = p.read_text(encoding="utf-8")

backup = p.with_name(
    p.name + ".before-view-popup-" + datetime.now().strftime("%Y%m%d-%H%M%S") + ".bak"
)
backup.write_text(s, encoding="utf-8")
print(f"Backup created: {backup}")

if "const [viewPermission, setViewPermission]" not in s:
    marker = "  const [actionLoading, setActionLoading] = useState<number | null>(null);"
    if marker not in s:
        raise SystemExit("Could not find actionLoading state.")
    s = s.replace(
        marker,
        marker + "\n  const [viewPermission, setViewPermission] = useState<PermissionRequest | null>(null);",
        1,
    )

# Add View button before the existing pending/undo action conditional.
marker = """                    <td>
                      {permission.status === 'PENDING' ? ("""
replacement = """                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="view-button"
                          onClick={() => setViewPermission(permission)}
                        >
                          View
                        </button>
                      </div>
                      {permission.status === 'PENDING' ? ("""

if "className=\"view-button\"" not in s:
    if marker not in s:
        raise SystemExit("Could not find permission action cell.")
    s = s.replace(marker, replacement, 1)

# Add popup before the page's style block.
style_marker = "      <style>{`"
modal = """      {viewPermission && (
        <div
          role="presentation"
          onClick={() => setViewPermission(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="permission-details-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              background: '#fff',
              borderRadius: '18px',
              padding: '24px',
              boxShadow: '0 24px 70px rgba(15,23,42,0.2)',
              color: '#17352b',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px',
              marginBottom: '22px',
            }}>
              <div>
                <h3 id="permission-details-title" style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  color: '#0f172a',
                }}>
                  Permission Details
                </h3>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '0.78rem',
                  color: '#64748b',
                }}>
                  Employee permission request information
                </p>
              </div>
              <button
                type="button"
                aria-label="Close permission details"
                onClick={() => setViewPermission(null)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#475569',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '16px',
              fontSize: '13px',
              lineHeight: 1.6,
              overflowWrap: 'anywhere',
            }}>
              <div>
                <strong>Employee</strong>
                <div>{viewPermission.employee_name || '--'}</div>
              </div>
              <div>
                <strong>Employee ID</strong>
                <div>{viewPermission.employee_id || '--'}</div>
              </div>
              <div>
                <strong>Permission Date</strong>
                <div>{formatDate(viewPermission.date)}</div>
              </div>
              <div>
                <strong>Duration</strong>
                <div>{formatDuration(viewPermission.duration_minutes)}</div>
              </div>
              <div>
                <strong>Reason</strong>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {viewPermission.reason || '--'}
                </div>
              </div>
              <div>
                <strong>Status</strong>
                <div>
                  <span className={`status-badge ${getStatusClass(viewPermission.status)}`}>
                    {viewPermission.status}
                  </span>
                </div>
              </div>
              {viewPermission.approved_by_name && (
                <div>
                  <strong>Processed By</strong>
                  <div>{viewPermission.approved_by_name}</div>
                </div>
              )}
              {viewPermission.approved_at && (
                <div>
                  <strong>Processed At</strong>
                  <div>{new Date(viewPermission.approved_at).toLocaleString('en-IN')}</div>
                </div>
              )}
              {viewPermission.rejection_reason && (
                <div>
                  <strong>Rejection Reason</strong>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {viewPermission.rejection_reason}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setViewPermission(null)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '10px',
                border: 'none',
                borderRadius: '9px',
                background: '#287a52',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

"""

if "permission-details-title" not in s:
    if style_marker not in s:
        raise SystemExit("Could not find the page style block.")
    s = s.replace(style_marker, modal + style_marker, 1)

# Add styling for the View button.
css_marker = "        .action-completed {"
css = """        .view-button {
          padding: 6px 12px;
          border: 1px solid #cfe4d8;
          border-radius: 8px;
          background: #f4fbf7;
          color: #287a52;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

"""
if ".view-button {" not in s:
    if css_marker not in s:
        raise SystemExit("Could not find CSS insertion point.")
    s = s.replace(css_marker, css + css_marker, 1)

p.write_text(s, encoding="utf-8")
print("Permission View popup added.")
