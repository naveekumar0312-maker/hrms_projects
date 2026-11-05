from pathlib import Path
from datetime import datetime

files = [
    Path("src/api/leaves.ts"),
    Path("src/api/permissions.ts"),
    Path("src/pages/Leaves.tsx"),
    Path("src/pages/Permissions.tsx"),
]

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
for file in files:
    backup = file.with_name(file.name + f".before-undo-{stamp}.bak")
    backup.write_text(file.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"Backup: {backup}")

# API functions
p = Path("src/api/leaves.ts")
s = p.read_text(encoding="utf-8")
if "export const undoLeave" not in s:
    s += """

export const undoLeave = async (id: number) => {
  const response = await api.patch(`/attendance/leaves/${id}/undo/`);
  return response.data;
};
"""
    p.write_text(s, encoding="utf-8")

p = Path("src/api/permissions.ts")
s = p.read_text(encoding="utf-8")
if "export const undoPermission" not in s:
    s += """

export const undoPermission = async (id: number) => {
  const response = await api.patch(`/attendance/permissions/${id}/undo/`);
  return response.data;
};
"""
    p.write_text(s, encoding="utf-8")

# Page changes
p = Path("src/pages/Leaves.tsx")
s = p.read_text(encoding="utf-8")
if "undoLeave" not in s:
    s = s.replace("  rejectLeave,\n", "  rejectLeave,\n  undoLeave,\n", 1)
    marker = "  const handleReject = async ("
    method = """  const handleUndo = async (id: number) => {
    try {
      setActionLoading(id);
      setError('');
      setSuccess('');
      await undoLeave(id);
      setSuccess('Leave request restored to pending successfully.');
      await loadLeaves();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to undo leave request.');
    } finally {
      setActionLoading(null);
    }
  };

"""
    if marker not in s:
        raise SystemExit("Could not locate Leaves handleReject insertion point.")
    s = s.replace(marker, method + marker, 1)
    old = """                        <span className="completed">
                          Completed
                        </span>"""
    new = """                        <button
                          type="button"
                          className="undo-button"
                          disabled={actionLoading === leave.id}
                          onClick={() => handleUndo(leave.id)}
                        >
                          {actionLoading === leave.id ? 'Undoing...' : 'Undo'}
                        </button>"""
    if old not in s:
        raise SystemExit("Could not locate Leaves Completed block.")
    s = s.replace(old, new, 1)
    css_marker = "        .completed {"
    css = """        .undo-button {
          padding: 6px 12px;
          border: 1px solid #d97706;
          border-radius: 6px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .undo-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

"""
    if css_marker not in s:
        raise SystemExit("Could not locate Leaves CSS insertion point.")
    s = s.replace(css_marker, css + css_marker, 1)
    p.write_text(s, encoding="utf-8")

p = Path("src/pages/Permissions.tsx")
s = p.read_text(encoding="utf-8")
if "undoPermission" not in s:
    s = s.replace("  rejectPermission,\n", "  rejectPermission,\n  undoPermission,\n", 1)
    marker = "  const handleReject = async (permission: PermissionRequest) => {"
    method = """  const handleUndo = async (id: number) => {
    try {
      setActionLoading(id);
      setError('');
      setSuccess('');
      await undoPermission(id);
      setSuccess('Permission request restored to pending successfully.');
      await loadPermissions();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to undo permission request.');
    } finally {
      setActionLoading(null);
    }
  };

"""
    if marker not in s:
        raise SystemExit("Could not locate Permissions handleReject insertion point.")
    s = s.replace(marker, method + marker, 1)
    old = """                        <span className="action-completed">
                          Completed
                        </span>"""
    new = """                        <button
                          type="button"
                          className="undo-button"
                          disabled={actionLoading === permission.id}
                          onClick={() => handleUndo(permission.id)}
                        >
                          {actionLoading === permission.id ? 'Undoing...' : 'Undo'}
                        </button>"""
    if old not in s:
        raise SystemExit("Could not locate Permissions Completed block.")
    s = s.replace(old, new, 1)
    css_marker = "        .action-completed {"
    css = """        .undo-button {
          padding: 6px 12px;
          border: 1px solid #d97706;
          border-radius: 6px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .undo-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

"""
    if css_marker not in s:
        raise SystemExit("Could not locate Permissions CSS insertion point.")
    s = s.replace(css_marker, css + css_marker, 1)
    p.write_text(s, encoding="utf-8")

print("Frontend Undo changes applied.")
