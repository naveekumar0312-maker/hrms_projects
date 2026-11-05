import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, RefreshCw, Trash2, Upload } from 'lucide-react';
import api from '../services/api';
import { CustomSelect } from './CustomSelect';
import './employee-documents.css';

type EmployeeDocument = {
  id: number;
  employee: number | { id: number };
  employee_id?: string;
  document_type: string;
  title: string;
  notes?: string;
  uploaded_at?: string;
  uploaded_by?: number | null;
};

type Props = {
  employeeId: number;
};

const DOCUMENT_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'BANK_PROOF', label: 'Bank Proof' },
  { value: 'EDUCATION', label: 'Educational Certificate' },
  { value: 'EXPERIENCE', label: 'Experience Certificate' },
  { value: 'PREVIOUS_APPOINTMENT', label: 'Previous Appointment Letter' },
  { value: 'OFFER_LETTER', label: 'Offer Letter' },
  { value: 'RELIEVING_LETTER', label: 'Relieving Letter' },
  { value: 'PASSPORT_PHOTO', label: 'Passport-size Photo' },
  { value: 'OTHER', label: 'Other' },
];

export default function EmployeeDocumentsPanel({ employeeId }: Props) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [documentType, setDocumentType] = useState('AADHAAR');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/employees/documents/');
      const data = response.data;
      const items: EmployeeDocument[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];

      setDocuments(
        items.filter((doc) => {
          const id =
            typeof doc.employee === 'object'
              ? doc.employee?.id
              : doc.employee;
          return Number(id) === Number(employeeId);
        })
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Could not load employee documents. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!file) {
      setError('Please select a document file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('The file must be 10 MB or smaller.');
      return;
    }

    const allowed = /\.(pdf|jpe?g|png|docx?)$/i;
    if (!allowed.test(file.name)) {
      setError('Allowed formats: PDF, JPG, JPEG, PNG, DOC and DOCX.');
      return;
    }

    const formData = new FormData();
    formData.append('employee', String(employeeId));
    formData.append('document_type', documentType);
    formData.append('title', title.trim() || file.name);
    formData.append('file', file);
    formData.append('notes', notes.trim());

    setUploading(true);

    try {
      await api.post('/employees/documents/', formData, {
        headers: { 'Content-Type': undefined },
      });

      setTitle('');
      setNotes('');
      setFile(null);

      const input = document.getElementById(
        `employee-document-file-${employeeId}`
      ) as HTMLInputElement | null;
      if (input) input.value = '';

      setSuccess('Document uploaded successfully.');
      await loadDocuments();
    } catch (err: any) {
      const data = err?.response?.data;
      const message =
        data?.detail ||
        data?.error ||
        data?.file?.[0] ||
        data?.employee?.[0] ||
        'Document upload failed. Check the file and try again.';

      setError(
        typeof message === 'string' ? message : 'Document upload failed.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (document: EmployeeDocument) => {
    setError('');
    setSuccess('');

    try {
      const response = await api.get(
        `/employees/documents/${document.id}/download/`,
        { responseType: 'blob' }
      );

      const blobUrl = URL.createObjectURL(
        new Blob([response.data])
      );
      const anchor = documentCreateAnchor(blobUrl, document.title);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Could not download this document. Please try again.');
    }
  };

  const handleDelete = async (document: EmployeeDocument) => {
    const confirmed = window.confirm(
      `Delete "${document.title}" permanently? This cannot be undone.`
    );
    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      await api.delete(`/employees/documents/${document.id}/`);
      setSuccess('Document deleted successfully.');
      await loadDocuments();
    } catch {
      setError('Could not delete this document. Please try again.');
    }
  };

  return (
    <section
      className="employee-documents-panel card"
      style={{
        padding: '1.25rem',
        boxShadow: 'none',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        marginTop: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <h3
          style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          Employee Documents
        </h3>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadDocuments()}
          disabled={loading}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem',
            marginBottom: '0.75rem',
            borderRadius: '6px',
            color: 'var(--danger)',
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border)',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            padding: '0.75rem',
            marginBottom: '0.75rem',
            borderRadius: '6px',
            color: 'var(--success)',
            border: '1px solid var(--border)',
            fontSize: '0.875rem',
          }}
        >
          {success}
        </div>
      )}

      <form
        onSubmit={handleUpload}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
          <span>Document Type</span>
          <CustomSelect
            value={documentType}
            onChange={setDocumentType}
            options={DOCUMENT_TYPES}
            placeholder="Select document type"
          />
        </div>

        <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
          Document Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Aadhaar front and back"
            style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
          Select File
          <input
            id={`employee-document-file-${employeeId}`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
            style={{ display: 'block', width: '100%', maxWidth: '100%', padding: '0.65rem', boxSizing: 'border-box' }}
          />
          <small style={{ color: 'var(--text-muted)' }}>
            PDF, images or Word documents  Maximum 10 MB
          </small>
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
          Notes (optional)
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add a note"
            style={{ width: '100%', padding: '0.65rem', boxSizing: 'border-box' }}
          />
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gridColumn: '1 / -1', paddingTop: '0.25rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={uploading}
          >
            <Upload size={15} />
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>Document</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Type</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Uploaded</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: '1rem 0.5rem' }}>
                  Loading documents...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: '1rem 0.5rem', color: 'var(--text-muted)' }}
                >
                  <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                  No documents uploaded for this employee.
                </td>
              </tr>
            ) : (
              documents.map((document) => (
                <tr key={document.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>
                    {document.title}
                    {document.notes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {document.notes}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {DOCUMENT_TYPES.find((type) => type.value === document.document_type)?.label
                      ?? document.document_type}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {document.uploaded_at
                      ? new Date(document.uploaded_at).toLocaleDateString()
                      : ''}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        title="Download document"
                        aria-label={`Download ${document.title}`}
                        onClick={() => void handleDownload(document)}
                      >
                        <Download size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        title="Delete document"
                        aria-label={`Delete ${document.title}`}
                        onClick={() => void handleDelete(document)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function documentCreateAnchor(url: string, filename: string) {
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'employee-document';
  return anchor;
}


