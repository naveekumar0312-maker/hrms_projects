import { useState, useEffect } from 'react';
import { type Branch } from '../pages/Branches';
import { type Company } from '../pages/Companies';
import api from '../services/api';
import { employeeService } from '../services/employeeService';
import {
  XCircle,
  Eye,
  EyeOff,
  User,
  Phone,
  Briefcase,
  Clock,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { formatTimeAMPM } from '../utils/timeUtils';
import { CustomSelect } from './CustomSelect';
import { CustomDatePicker } from './CustomDatePicker';
import './EmployeeForm.css';

interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

interface EmployeeFormProps {
  onClose: () => void;
  onSuccess: () => void;
  employeeId?: number;
  pageMode?: boolean;
}

type FormTab = 'basic' | 'contact' | 'employment' | 'work' | 'account';

interface TabConfig {
  id: FormTab;
  label: string;
  description: string;
  icon: any;
}

const FORM_TABS: TabConfig[] = [
  { id: 'basic', label: 'Basic Information', description: 'Personal identity & photo', icon: User },
  { id: 'contact', label: 'Contact & Emergency', description: 'Phone, email & address', icon: Phone },
  { id: 'employment', label: 'Employment Details', description: 'Company, branch & records', icon: Briefcase },
  { id: 'work', label: 'Work & Attendance', description: 'Shifts & work location type', icon: Clock },
  { id: 'account', label: 'Account & Security', description: 'Login credentials & access', icon: ShieldCheck },
];

export const EmployeeForm = ({ onClose, onSuccess, employeeId, pageMode = false }: EmployeeFormProps) => {
  const isEdit = !!employeeId;
  const [activeTab, setActiveTab] = useState<FormTab>('basic');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');

  const [formData, setFormData] = useState({
    employee_id: '',
    company: '',
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
    branch: '',
    department: '',
    designation: '',
    work_type: 'OFFICE',
    shift: '',
    status: true,
    joining_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    date_of_birth: '',
    gender: '',
    current_address: '',
    permanent_address: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    reporting_manager: '',
    employment_type: 'FULL_TIME',
    probation_period_months: '3',
    confirmation_date: '',
    notice_period_days: '30',
    employment_status: 'ACTIVE',
    aadhaar_number: '',
    pan_number: '',
    bank_account_holder: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_name: '',
    bank_branch: '',
    education_details: '[]',
    previous_employment_details: '[]',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [managerOptions, setManagerOptions] = useState<any[]>([]);

  type PendingDocument = {
    document_type: string;
    title: string;
    file: File | null;
    notes: string;
  };

  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [candidateType, setCandidateType] = useState<'FRESHER' | 'EXPERIENCED'>('FRESHER');
  const documentTypes = [
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [compRes, branchRes, shiftRes, employeeRes] = await Promise.all([
          api.get('/companies/'),
          api.get('/branches/'),
          api.get('/shifts/active/'),
          employeeService.getEmployees(),
        ]);
        const compList = Array.isArray(compRes.data) ? compRes.data : compRes.data?.results || [];
        const branchList = Array.isArray(branchRes.data) ? branchRes.data : branchRes.data?.results || [];
        const shiftList = Array.isArray(shiftRes.data) ? shiftRes.data : shiftRes.data?.results || [];

        setCompanies(compList);
        setBranches(branchList);
        setShifts(shiftList);

        if (!isEdit && compList.length === 1) {
          setFormData(prev => ({ ...prev, company: compList[0].id.toString() }));
        }

        const employeeList = Array.isArray(employeeRes.data)
          ? employeeRes.data
          : Array.isArray(employeeRes.data?.results)
            ? employeeRes.data.results
            : [];

        setManagerOptions(employeeList);

        if (isEdit) {
          const empRes = await employeeService.getEmployee(employeeId);
          const emp = empRes.data;
          const currentPhoto = emp.profile_photo || '';
          setExistingPhotoUrl(currentPhoto);
          setPhotoPreviewUrl(currentPhoto);
          const existingEmployment = Array.isArray(emp.previous_employment_details)
            ? emp.previous_employment_details
            : [];
          setCandidateType(existingEmployment.length > 0 ? 'EXPERIENCED' : 'FRESHER');

          setFormData({
            employee_id: emp.employee_id || '',
            company: emp.company?.id?.toString() || (emp.branch ? branchList.find((b: any) => b.id === emp.branch)?.company?.toString() : ''),
            full_name: emp.full_name || '',
            email: emp.email || '',
            phone_number: emp.user?.phone_number || emp.phone_number || '',
            password: '',
            confirm_password: '',
            branch: emp.branch?.id?.toString() || emp.branch?.toString() || '',
            department: emp.department || '',
            designation: emp.designation || '',
            work_type: emp.work_type || 'OFFICE',
            shift: emp.shift?.id?.toString() || emp.shift?.toString() || '',
            status: emp.status !== undefined ? emp.status : true,
            joining_date: emp.joining_date || '',
            date_of_birth: emp.date_of_birth || '',
            gender: emp.gender || '',
            current_address: emp.current_address || '',
            permanent_address: emp.permanent_address || '',
            emergency_contact_name: emp.emergency_contact_name || '',
            emergency_contact_number: emp.emergency_contact_number || '',
            reporting_manager: emp.reporting_manager?.toString() || '',
            employment_type: emp.employment_type || 'FULL_TIME',
            probation_period_months: emp.probation_period_months?.toString() || '3',
            confirmation_date: emp.confirmation_date || '',
            notice_period_days: emp.notice_period_days?.toString() || '30',
            employment_status: emp.employment_status || (emp.status ? 'ACTIVE' : 'RESIGNED'),
            aadhaar_number: emp.aadhaar_number || '',
            pan_number: emp.pan_number || '',
            bank_account_holder: emp.bank_account_holder || '',
            bank_account_number: emp.bank_account_number || '',
            bank_ifsc: emp.bank_ifsc || '',
            bank_name: emp.bank_name || '',
            bank_branch: emp.bank_branch || '',
            education_details: JSON.stringify(emp.education_details || [], null, 2),
            previous_employment_details: JSON.stringify(emp.previous_employment_details || [], null, 2),
          });
        }
      } catch (err) {
        console.error("Failed to fetch initial data", err);
        setError("Failed to load initial data.");
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [isEdit, employeeId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      if (name === 'company') {
        return { ...prev, company: value, branch: '' };
      }
      return { ...prev, [name]: value };
    });
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const TAB_FIELDS: Record<FormTab, string[]> = {
    basic: ['full_name', 'date_of_birth'],
    contact: ['phone_number', 'email', 'emergency_contact_number'],
    employment: ['company', 'branch', 'department', 'designation', 'joining_date', 'confirmation_date', 'aadhaar_number', 'pan_number', 'bank_ifsc', 'education_details', 'previous_employment_details'],
    work: ['work_type', 'shift'],
    account: ['password', 'confirm_password'],
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Basic Information
    if (!formData.full_name.trim()) errors.full_name = 'Please enter employee name.';
    if (formData.date_of_birth) {
      const dob = new Date(`${formData.date_of_birth}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(dob.getTime()) || dob >= today) {
        errors.date_of_birth = 'Date of birth must be earlier than today.';
      }
    }

    // Contact Information
    if (!formData.phone_number.trim()) {
      errors.phone_number = 'Phone number is required.';
    } else if (!/^[6-9]\d{9}$/.test(formData.phone_number)) {
      errors.phone_number = 'Enter a valid 10-digit Indian mobile number.';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    const emergencyPhone = formData.emergency_contact_number.trim();
    if (emergencyPhone && !/^[6-9]\d{9}$/.test(emergencyPhone)) {
      errors.emergency_contact_number = 'Enter a valid 10-digit Indian mobile number.';
    }

    // Employment Details
    if (!formData.company) errors.company = 'Please select a company.';
    if (!formData.branch) errors.branch = 'Please select a branch.';
    const selectedBranch = branches.find(b => b.id.toString() === formData.branch);
    if (selectedBranch && selectedBranch.company.toString() !== formData.company) {
      errors.branch = 'Selected branch does not belong to the selected company.';
    }

    if (!formData.department.trim()) errors.department = 'Please enter department.';
    if (!formData.designation.trim()) errors.designation = 'Please enter designation.';

    if (formData.joining_date && formData.confirmation_date &&
        formData.confirmation_date < formData.joining_date) {
      errors.confirmation_date = 'Confirmation date cannot be before joining date.';
    }

    const aadhaar = formData.aadhaar_number.replace(/\s/g, '');
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
      errors.aadhaar_number = 'Aadhaar must contain exactly 12 digits.';
    }

    const pan = formData.pan_number.trim().toUpperCase();
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
      errors.pan_number = 'Enter a valid PAN number.';
    }

    const ifsc = formData.bank_ifsc.trim().toUpperCase();
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      errors.bank_ifsc = 'Enter a valid bank IFSC code.';
    }

    for (const field of ['education_details', 'previous_employment_details'] as const) {
      try {
        if (!Array.isArray(JSON.parse(formData[field] || '[]'))) {
          errors[field] = 'Enter a valid JSON array.';
        }
      } catch {
        errors[field] = 'Enter valid JSON array data.';
      }
    }

    // Work & Attendance
    if (!formData.work_type) errors.work_type = 'Please select work type.';
    if (!formData.shift) errors.shift = 'Please select a shift.';

    // Account & Security
    if (!isEdit || formData.password) {
      if (!isEdit && !formData.password) {
        errors.password = 'Password is required.';
      } else if (formData.password && formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters long.';
      }

      if (formData.password !== formData.confirm_password) {
        errors.confirm_password = 'Passwords do not match.';
      }
    }

    setValidationErrors(errors);
    return errors;
  };

  const getTabErrorCount = (tabId: FormTab, errorsObj = validationErrors): number => {
    const fields = TAB_FIELDS[tabId] || [];
    return fields.filter(f => !!errorsObj[f]).length;
  };

  const handleNextTab = () => {
    const currentIndex = FORM_TABS.findIndex(t => t.id === activeTab);
    if (currentIndex < FORM_TABS.length - 1) {
      setActiveTab(FORM_TABS[currentIndex + 1].id);
    }
  };

  const handlePrevTab = () => {
    const currentIndex = FORM_TABS.findIndex(t => t.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(FORM_TABS[currentIndex - 1].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      // Find first tab with errors and switch to it
      for (const tab of FORM_TABS) {
        if (getTabErrorCount(tab.id, errors) > 0) {
          setActiveTab(tab.id);
          break;
        }
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        company: parseInt(formData.company, 10),
        full_name: formData.full_name,
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.phone_number,
        branch: parseInt(formData.branch, 10),
        department: formData.department,
        designation: formData.designation,
        work_type: formData.work_type,
        shift: parseInt(formData.shift, 10),
        status: formData.employment_status === 'ACTIVE',
        joining_date: formData.joining_date || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || '',
        current_address: formData.current_address,
        permanent_address: formData.permanent_address,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_number: formData.emergency_contact_number,
        reporting_manager: formData.reporting_manager ? Number(formData.reporting_manager) : null,
        employment_type: formData.employment_type,
        probation_period_months: formData.probation_period_months === '' ? null : Number(formData.probation_period_months),
        confirmation_date: formData.confirmation_date || null,
        notice_period_days: formData.notice_period_days === '' ? null : Number(formData.notice_period_days),
        employment_status: formData.employment_status,
        aadhaar_number: formData.aadhaar_number,
        pan_number: formData.pan_number,
        bank_account_holder: formData.bank_account_holder,
        bank_account_number: formData.bank_account_number,
        bank_ifsc: formData.bank_ifsc,
        bank_name: formData.bank_name,
        bank_branch: formData.bank_branch,
        education_details: JSON.parse(formData.education_details || '[]'),
        previous_employment_details: JSON.parse(formData.previous_employment_details || '[]'),
      };

      if (formData.password) {
        payload.password = formData.password;
        payload.confirm_password = formData.confirm_password;
      }

      let savedEmployeeId: number;

      if (isEdit) {
        await employeeService.updateEmployee(employeeId, payload);
        savedEmployeeId = Number(employeeId);
      } else {
        const createResponse = await employeeService.createEmployee(payload);
        savedEmployeeId = Number(createResponse.data?.id);

        if (!savedEmployeeId && pendingDocuments.length > 0) {
          alert("Employee was saved, but the response did not contain its numeric ID. Documents were not uploaded.");
          onSuccess();
          return;
        }
      }

      const uploadErrors: string[] = [];

      if (selectedPhoto) {
        try {
          if (!savedEmployeeId) {
            throw new Error('Employee ID was not returned by the API.');
          }
          const photoPayload = new FormData();
          photoPayload.append('profile_photo', selectedPhoto);
          await api.patch(`/employees/${savedEmployeeId}/`, photoPayload, {
            headers: { 'Content-Type': undefined },
          });
        } catch (photoError: any) {
          const detail =
            photoError?.response?.data?.profile_photo?.[0] ||
            photoError?.response?.data?.detail ||
            photoError?.message ||
            'Upload failed';
          uploadErrors.push(`Profile photo: ${detail}`);
        }
      }

      for (const doc of pendingDocuments) {
        if (!doc.file) {
          uploadErrors.push(`${doc.title || doc.document_type}: select a file.`);
          continue;
        }

        if (doc.file.size > 10 * 1024 * 1024) {
          uploadErrors.push(`${doc.file.name}: maximum file size is 10 MB.`);
          continue;
        }

        if (!/\.(pdf|jpe?g|png|docx?)$/i.test(doc.file.name)) {
          uploadErrors.push(`${doc.file.name}: unsupported file format.`);
          continue;
        }

        const documentPayload = new FormData();
        documentPayload.append("employee", String(savedEmployeeId));
        documentPayload.append("document_type", doc.document_type);
        documentPayload.append("title", doc.title.trim() || doc.file.name);
        documentPayload.append("file", doc.file);
        documentPayload.append("notes", doc.notes.trim());

        try {
          await api.post("/employees/documents/", documentPayload, {
            headers: { "Content-Type": undefined },
          });
        } catch (uploadError: any) {
          const detail =
            uploadError?.response?.data?.detail ||
            uploadError?.response?.data?.file?.[0] ||
            "Upload failed";
          uploadErrors.push(`${doc.file.name}: ${detail}`);
        }
      }

      if (uploadErrors.length) {
        alert(
          `Employee ${isEdit ? "updated" : "created"}, but some files failed to upload:\n\n${uploadErrors.join("\n")}\n\nOpen Edit Employee to retry.`
        );
      } else {
        alert(isEdit ? "Employee details updated successfully." : "Employee created successfully.");
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.response?.data && typeof err.response.data === 'object' && !err.response.data.detail) {
        const errorMessages = Object.entries(err.response.data)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
          .join(' | ');
        setError(errorMessages);
      } else {
        setError(err.response?.data?.detail || 'Failed to save employee.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading employee details...
      </div>
    );
  }

  const isLastTab = activeTab === FORM_TABS[FORM_TABS.length - 1].id;
  const isFirstTab = activeTab === FORM_TABS[0].id;

  return (
    <div className={pageMode ? "employee-form-fullscreen-wrap" : "employee-modal-overlay"}>
      <div className={pageMode ? "employee-form-card" : "employee-modal-content"}>
        {/* Header */}
        <div className="employee-form-header">
          <div>
            <h1>
              {isEdit ? 'Edit Employee Profile' : 'Add New Employee'}
            </h1>
            <p>
              {isEdit
                ? `Updating details for ${formData.full_name || formData.employee_id || 'Employee'}`
                : 'Configure basic information, contact, employment records, shifts, and access credentials'}
            </p>
          </div>

          {!pageMode && (
            <button onClick={onClose} className="btn-icon" aria-label="Close form">
              <XCircle size={22} />
            </button>
          )}
        </div>

        {/* Horizontal Navigation Tabs */}
        <nav aria-label="Employee Form Steps" className="employee-form-tabs">
          {FORM_TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const errCount = getTabErrorCount(tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`employee-tab-btn ${isActive ? 'active' : ''}`}
              >
                <span className="employee-tab-step-badge">
                  {idx + 1}
                </span>

                <Icon size={18} />
                <span>{tab.label}</span>

                {errCount > 0 && (
                  <span className="employee-tab-error-badge">
                    {errCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Global Error Banner */}
        {error && (
          <div className="employee-form-error-banner">
            <AlertCircle size={20} className="employee-form-error-banner-icon" />
            <span className="employee-form-error-banner-text">{error}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="employee-form-body">
          <form onSubmit={handleSubmit}>

            {/* TAB 1: BASIC INFORMATION */}
            {activeTab === 'basic' && (
              <div className="employee-tab-pane">
                <section>
                  <h3 className="employee-section-title">
                    1. Identity & System Code
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Employee ID</label>
                      <input
                        type="text"
                        className="form-control"
                        value={isEdit ? formData.employee_id : "Auto Generated by Server"}
                        disabled
                        style={{ backgroundColor: 'var(--primary-light)', color: 'var(--text-secondary)', fontWeight: 600 }}
                      />
                      <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                        Unique alphanumeric employee code
                      </small>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Employee Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="e.g., Arun Kumar"
                      />
                      {validationErrors.full_name && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="employee-section-title">
                    2. Profile Photo
                  </h3>
                  <div className="employee-photo-row">
                    {photoPreviewUrl ? (
                      <img
                        src={photoPreviewUrl}
                        alt="Employee profile preview"
                        className="employee-photo-preview"
                      />
                    ) : (
                      <div className="employee-photo-placeholder">
                        <User size={30} className="employee-photo-placeholder-icon" />
                        <span>No Photo</span>
                      </div>
                    )}

                    <div className="employee-photo-controls">
                      <input
                        id="profile-photo-input"
                        type="file"
                        style={{ display: 'none' }}
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (!file) return;
                          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                            alert('Please choose a JPG, PNG, or WEBP image.');
                            e.target.value = '';
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            alert('Profile photo must be 5 MB or smaller.');
                            e.target.value = '';
                            return;
                          }
                          setSelectedPhoto(file);
                          setPhotoPreviewUrl(URL.createObjectURL(file));
                        }}
                      />
                      <label htmlFor="profile-photo-input" className="employee-photo-upload-btn">
                        <Upload size={16} /> Choose Photo
                      </label>

                      {selectedPhoto && (
                        <div className="employee-photo-file-status">
                          <span>{selectedPhoto.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhoto(null);
                              setPhotoPreviewUrl(existingPhotoUrl);
                            }}
                            className="employee-photo-remove-btn"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      <small className="employee-field-help">
                        Recommended square format: JPG, PNG, or WEBP. Maximum 5 MB.
                      </small>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="employee-section-title">
                    3. Demographic Information
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Date of Birth</label>
                      <CustomDatePicker
                        value={formData.date_of_birth}
                        onChange={(val) => handleChange({ target: { name: 'date_of_birth', value: val } } as any)}
                        placeholder="Select date of birth"
                      />
                      {validationErrors.date_of_birth && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.date_of_birth}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Gender</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className="form-control"
                      >
                        <option value="">Select Gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 2: CONTACT INFORMATION */}
            {activeTab === 'contact' && (
              <div className="employee-tab-pane">
                <section>
                  <h3 className="employee-section-title">
                    1. Primary Communication
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Phone Number <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="phone_number"
                        value={formData.phone_number}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="e.g., 9876543210"
                      />
                      <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                        Used as the primary username for employee mobile & web sign in
                      </small>
                      {validationErrors.phone_number && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.phone_number}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Email Address</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="e.g., employee@company.com"
                      />
                      {validationErrors.email && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.email}
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="employee-section-title">
                    2. Residential Address
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Current Address</label>
                      <textarea
                        name="current_address"
                        value={formData.current_address}
                        onChange={e => setFormData(p => ({ ...p, current_address: e.target.value }))}
                        className="form-control"
                        rows={3}
                        placeholder="Door number, street, city, pin code..."
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Permanent Address</label>
                      <textarea
                        name="permanent_address"
                        value={formData.permanent_address}
                        onChange={e => setFormData(p => ({ ...p, permanent_address: e.target.value }))}
                        className="form-control"
                        rows={3}
                        placeholder="Permanent domicile address..."
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="employee-section-title">
                    3. Emergency Contact
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Emergency Contact Name</label>
                      <input
                        type="text"
                        name="emergency_contact_name"
                        value={formData.emergency_contact_name}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="e.g., Relative or Guardian name"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Emergency Contact Number</label>
                      <input
                        type="text"
                        name="emergency_contact_number"
                        value={formData.emergency_contact_number}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="e.g., 9876543210"
                      />
                      {validationErrors.emergency_contact_number && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.emergency_contact_number}
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 3: EMPLOYMENT DETAILS */}
            {activeTab === 'employment' && (
              <div className="employee-tab-pane">
                <section>
                  <h3 className="employee-section-title">
                    1. Organization Assignment
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Company <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <CustomSelect
                        options={[
                          { value: "", label: "Select Company" },
                          ...companies.filter(c => c.status).map(c => ({ value: c.id.toString(), label: c.name }))
                        ]}
                        value={formData.company}
                        onChange={(val) => handleChange({ target: { name: 'company', value: val } } as any)}
                        searchPlaceholder="Search companies..."
                      />
                      {validationErrors.company && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.company}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Branch Office <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <CustomSelect
                        options={[
                          { value: "", label: "Select Branch" },
                          ...branches
                            .filter(b => b.status && (!formData.company || b.company === parseInt(formData.company, 10)))
                            .map(b => ({ value: b.id.toString(), label: b.branch_name }))
                        ]}
                        value={formData.branch}
                        onChange={(val) => handleChange({ target: { name: 'branch', value: val } } as any)}
                        searchPlaceholder="Search branches..."
                      />
                      {validationErrors.branch && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.branch}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Department <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="e.g., Engineering, Sales, Operations"
                      />
                      {validationErrors.department && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.department}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Designation <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="designation"
                        value={formData.designation}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="e.g., Senior Software Engineer"
                      />
                      {validationErrors.designation && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.designation}
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="employee-section-title">
                    2. Terms of Employment
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Date of Joining</label>
                      <CustomDatePicker
                        value={formData.joining_date}
                        onChange={(val) => handleChange({ target: { name: 'joining_date', value: val } } as any)}
                        placeholder="Select joining date"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Employment Type</label>
                      <select
                        name="employment_type"
                        value={formData.employment_type}
                        onChange={handleChange}
                        className="form-control"
                      >
                        <option value="FULL_TIME">Full Time</option>
                        <option value="PART_TIME">Part Time</option>
                        <option value="CONTRACT">Contract</option>
                        <option value="INTERN">Intern</option>
                        <option value="TEMPORARY">Temporary</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Probation Period (Months)</label>
                      <input
                        type="number"
                        min="0"
                        name="probation_period_months"
                        value={formData.probation_period_months}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Confirmation Date</label>
                      <CustomDatePicker
                        value={formData.confirmation_date}
                        onChange={(val) => handleChange({ target: { name: 'confirmation_date', value: val } } as any)}
                        placeholder="Select confirmation date"
                      />
                      {validationErrors.confirmation_date && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.confirmation_date}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Notice Period (Days)</label>
                      <input
                        type="number"
                        min="0"
                        name="notice_period_days"
                        value={formData.notice_period_days}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Reporting Manager</label>
                      <select
                        name="reporting_manager"
                        value={formData.reporting_manager}
                        onChange={handleChange}
                        className="form-control"
                      >
                        <option value="">No reporting manager assigned</option>
                        {managerOptions
                          .filter((manager: any) => String(manager.id) !== String(employeeId))
                          .map((manager: any) => (
                            <option key={manager.id} value={String(manager.id)}>
                              {manager.full_name || manager.employee_id || `Employee ${manager.id}`}
                              {manager.employee_id ? ` (${manager.employee_id})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Employment Status</label>
                      <select
                        name="employment_status"
                        value={formData.employment_status}
                        onChange={handleChange}
                        className="form-control"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="RESIGNED">Resigned</option>
                        <option value="TERMINATED">Terminated</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="employee-section-title">
                    3. Statutory Identity & Banking
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Aadhaar Number (12 digits)</label>
                      <input
                        name="aadhaar_number"
                        value={formData.aadhaar_number}
                        onChange={handleChange}
                        className="form-control"
                        maxLength={12}
                        placeholder="123456789012"
                      />
                      {validationErrors.aadhaar_number && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.aadhaar_number}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>PAN Number</label>
                      <input
                        name="pan_number"
                        value={formData.pan_number}
                        onChange={handleChange}
                        className="form-control"
                        maxLength={10}
                        style={{ textTransform: 'uppercase' }}
                        placeholder="ABCDE1234F"
                      />
                      {validationErrors.pan_number && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.pan_number}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Bank Account Holder Name</label>
                      <input
                        name="bank_account_holder"
                        value={formData.bank_account_holder}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Bank Account Number</label>
                      <input
                        name="bank_account_number"
                        value={formData.bank_account_number}
                        onChange={handleChange}
                        className="form-control"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>IFSC Code</label>
                      <input
                        name="bank_ifsc"
                        value={formData.bank_ifsc}
                        onChange={handleChange}
                        className="form-control"
                        maxLength={11}
                        style={{ textTransform: 'uppercase' }}
                        placeholder="SBIN0001234"
                      />
                      {validationErrors.bank_ifsc && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.bank_ifsc}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Bank Name</label>
                      <input
                        name="bank_name"
                        value={formData.bank_name}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="e.g., State Bank of India"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Bank Branch</label>
                      <input
                        name="bank_branch"
                        value={formData.bank_branch}
                        onChange={handleChange}
                        className="form-control"
                        placeholder="Branch location"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, fontWeight: 700 }}>
                      4. Verification Documents
                    </h3>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setPendingDocuments(prev => [...prev, { document_type: 'AADHAAR', title: '', file: null, notes: '' }])}
                      style={{ fontSize: '0.8rem', padding: '0 0.85rem', height: '34px' }}
                    >
                      <Plus size={15} /> Add Document
                    </button>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0, marginBottom: '1rem' }}>
                    PDF, JPG, PNG, DOC or DOCX. Maximum 10 MB per file.
                  </p>

                  {pendingDocuments.map((doc, index) => (
                    <div key={index} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1rem', background: 'var(--bg-page)' }}>
                      <div className="employee-grid-2">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Document Type</label>
                          <select
                            className="form-control"
                            value={doc.document_type}
                            onChange={e => setPendingDocuments(prev => prev.map((item, i) => i === index ? { ...item, document_type: e.target.value } : item))}
                          >
                            {documentTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Document Title</label>
                          <input
                            className="form-control"
                            value={doc.title}
                            placeholder="e.g. Aadhaar Card Front & Back"
                            onChange={e => setPendingDocuments(prev => prev.map((item, i) => i === index ? { ...item, title: e.target.value } : item))}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Upload File</label>
                          <input
                            id={`employee-document-file-${index}`}
                            type="file"
                            style={{ display: 'none' }}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={e => setPendingDocuments(prev => prev.map((item, i) => i === index ? { ...item, file: e.target.files?.[0] ?? null } : item))}
                          />
                          <label
                            htmlFor={`employee-document-file-${index}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.65rem 1.1rem',
                              background: 'var(--primary)',
                              color: '#fff',
                              borderRadius: '8px',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                            }}
                          >
                            <Upload size={15} /> Select Document
                          </label>
                          {doc.file && (
                            <small style={{ display: 'block', marginTop: '0.4rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                              {doc.file.name}
                            </small>
                          )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Notes / Remarks (Optional)</label>
                          <input
                            className="form-control"
                            value={doc.notes}
                            placeholder="Optional verification note"
                            onChange={e => setPendingDocuments(prev => prev.map((item, i) => i === index ? { ...item, notes: e.target.value } : item))}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setPendingDocuments(prev => prev.filter((_, i) => i !== index))}
                          style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '0 0.85rem', height: '32px' }}
                        >
                          <Trash2 size={14} /> Remove Document
                        </button>
                      </div>
                    </div>
                  ))}
                </section>

                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, fontWeight: 700 }}>
                      5. Educational History
                    </h3>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setFormData(p => ({
                        ...p,
                        education_details: JSON.stringify([...(JSON.parse(p.education_details || '[]') as any[]), { qualification: '', institution: '', specialization: '', year: '', grade: '' }])
                      }))}
                      style={{ fontSize: '0.8rem', padding: '0 0.85rem', height: '34px' }}
                    >
                      <Plus size={15} /> Add Education
                    </button>
                  </div>

                  {(JSON.parse(formData.education_details || '[]') as any[]).map((item, index, rows) => (
                    <div key={index} style={{ border: '1px solid var(--border)', padding: '1.25rem', borderRadius: '10px', marginBottom: '1rem', background: 'var(--bg-page)' }}>
                      <h4 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Education #{index + 1}</h4>
                      <div className="employee-grid-2">
                        {[
                          ['qualification', 'Qualification / Degree'],
                          ['institution', 'Institution / University'],
                          ['specialization', 'Course / Specialization'],
                          ['year', 'Year of Passing'],
                          ['grade', 'Percentage / CGPA'],
                        ].map(([field, label]) => (
                          <div className="form-group" key={field} style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontWeight: 600 }}>{label}</label>
                            <input
                              className="form-control"
                              value={item[field] ?? ''}
                              onChange={e => {
                                const updated = [...rows];
                                updated[index] = { ...item, [field]: e.target.value };
                                setFormData(p => ({ ...p, education_details: JSON.stringify(updated) }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setFormData(p => ({
                            ...p,
                            education_details: JSON.stringify((JSON.parse(p.education_details || '[]') as any[]).filter((_, i) => i !== index))
                          }))}
                          style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '0 0.85rem', height: '32px' }}
                        >
                          <Trash2 size={14} /> Remove Row
                        </button>
                      </div>
                    </div>
                  ))}
                </section>

                <section>
                  <h3 className="employee-section-title">
                    6. Previous Employment Background
                  </h3>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Candidate Experience Category</label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          background: candidateType === 'FRESHER' ? 'var(--primary)' : 'transparent',
                          color: candidateType === 'FRESHER' ? '#fff' : 'var(--text-primary)',
                          fontWeight: candidateType === 'FRESHER' ? 700 : 500,
                        }}
                        onClick={() => {
                          setCandidateType('FRESHER');
                          setFormData(p => ({ ...p, previous_employment_details: '[]' }));
                        }}
                      >
                        Fresher
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          background: candidateType === 'EXPERIENCED' ? 'var(--primary)' : 'transparent',
                          color: candidateType === 'EXPERIENCED' ? '#fff' : 'var(--text-primary)',
                          fontWeight: candidateType === 'EXPERIENCED' ? 700 : 500,
                        }}
                        onClick={() => {
                          setCandidateType('EXPERIENCED');
                          const rows = JSON.parse(formData.previous_employment_details || '[]') as any[];
                          if (!rows.length) {
                            setFormData(p => ({ ...p, previous_employment_details: JSON.stringify([{ company: '', designation: '', from: '', to: '', last_drawn_salary: '', reason_for_leaving: '' }]) }));
                          }
                        }}
                      >
                        Experienced Professional
                      </button>
                    </div>
                  </div>

                  {candidateType === 'EXPERIENCED' && (
                    <>
                      {(JSON.parse(formData.previous_employment_details || '[]') as any[]).map((item, index, rows) => (
                        <div key={index} style={{ border: '1px solid var(--border)', padding: '1.25rem', borderRadius: '10px', marginBottom: '1rem', background: 'var(--bg-page)' }}>
                          <h4 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Prior Employment #{index + 1}</h4>
                          <div className="employee-grid-2">
                            {[
                              ['company', 'Organization / Company Name', 'text'],
                              ['designation', 'Designation / Role', 'text'],
                              ['from', 'Start Date', 'date'],
                              ['to', 'End Date', 'date'],
                              ['last_drawn_salary', 'Last Drawn CTC / Salary', 'number'],
                              ['reason_for_leaving', 'Reason for Relieving', 'text'],
                            ].map(([field, label, type]) => (
                              <div className="form-group" key={field} style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{label}</label>
                                <input
                                  type={type}
                                  className="form-control"
                                  value={item[field] ?? ''}
                                  onChange={e => {
                                    const updated = [...rows];
                                    updated[index] = { ...item, [field]: e.target.value };
                                    setFormData(p => ({ ...p, previous_employment_details: JSON.stringify(updated) }));
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setFormData(p => ({
                                ...p,
                                previous_employment_details: JSON.stringify((JSON.parse(p.previous_employment_details || '[]') as any[]).filter((_, i) => i !== index))
                              }))}
                              style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '0 0.85rem', height: '32px' }}
                            >
                              <Trash2 size={14} /> Remove History
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setFormData(p => ({
                          ...p,
                          previous_employment_details: JSON.stringify([...(JSON.parse(p.previous_employment_details || '[]') as any[]), { company: '', designation: '', from: '', to: '', last_drawn_salary: '', reason_for_leaving: '' }])
                        }))}
                        style={{ fontSize: '0.8rem', padding: '0 0.85rem', height: '34px' }}
                      >
                        <Plus size={15} /> Add Another Employment History
                      </button>
                    </>
                  )}
                </section>
              </div>
            )}

            {/* TAB 4: WORK & ATTENDANCE */}
            {activeTab === 'work' && (
              <div className="employee-tab-pane">
                <section>
                  <h3 className="employee-section-title">
                    1. Work Assignment & Policy
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Work Location Type <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <CustomSelect
                        options={[
                          { value: "OFFICE", label: "Office Based (Branch Geofencing Enforced)" },
                          { value: "FIELD", label: "Field / Marketing (Dynamic Location Tracking)" },
                        ]}
                        value={formData.work_type}
                        onChange={(val) => handleChange({ target: { name: 'work_type', value: val } } as any)}
                      />
                      {validationErrors.work_type && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.work_type}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Shift Schedule <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <CustomSelect
                        options={[
                          { value: "", label: "Select Working Shift" },
                          ...shifts.map(s => ({
                            value: s.id.toString(),
                            label: `${s.name} (${formatTimeAMPM(s.start_time)} - ${formatTimeAMPM(s.end_time)})`
                          }))
                        ]}
                        value={formData.shift}
                        onChange={(val) => handleChange({ target: { name: 'shift', value: val } } as any)}
                        searchPlaceholder="Search shifts..."
                      />
                      {validationErrors.shift && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.shift}
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                {isEdit && (
                  <section>
                    <h3 className="employee-section-title">
                      2. Active System Status
                    </h3>
                    <div className="employee-grid-2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                          Attendance Status <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <CustomSelect
                          options={[
                            { value: "true", label: "Active (Allowed to punch attendance)" },
                            { value: "false", label: "Inactive (Punches disabled)" },
                          ]}
                          value={formData.status ? 'true' : 'false'}
                          onChange={(val) => setFormData(prev => ({ ...prev, status: val === 'true' }))}
                        />
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* TAB 5: ACCOUNT & SECURITY */}
            {activeTab === 'account' && (
              <div className="employee-tab-pane">
                <section>
                  <h3 className="employee-section-title">
                    1. Login Credentials
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Login Identifier / Username</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.phone_number || 'Phone number entered in Contact tab'}
                        disabled
                        style={{ backgroundColor: 'var(--primary-light)', color: 'var(--text-secondary)', fontWeight: 600 }}
                      />
                      <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                        The employee signs in using this verified phone number
                      </small>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>System Role</label>
                      <input
                        type="text"
                        className="form-control"
                        value="EMPLOYEE (Restricted to mobile attendance & leave tracking)"
                        disabled
                        style={{ backgroundColor: 'var(--primary-light)', color: 'var(--text-secondary)', fontWeight: 600 }}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="employee-section-title">
                    2. {isEdit ? 'Update Security Password (Optional)' : 'Set Password'}
                  </h3>
                  <div className="employee-grid-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        {isEdit ? 'New Password' : 'Password'} {!isEdit && <span style={{ color: 'var(--danger)' }}>*</span>}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          autoComplete="new-password"
                          className="form-control"
                          placeholder={isEdit ? "Leave blank to keep current password" : "At least 8 characters"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="employee-password-toggle-btn"
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {validationErrors.password && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.password}
                        </span>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>
                        Confirm Password {!isEdit && <span style={{ color: 'var(--danger)' }}>*</span>}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirm_password"
                          value={formData.confirm_password}
                          onChange={handleChange}
                          autoComplete="new-password"
                          className="form-control"
                          placeholder="Re-enter password to confirm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="employee-password-toggle-btn"
                          aria-label="Toggle confirm password visibility"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {validationErrors.confirm_password && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                          {validationErrors.confirm_password}
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

          </form>
        </div>

        {/* Footer Navigation & Actions */}
        <div className="employee-form-footer">
          <div>
            <button
              type="button"
              onClick={handlePrevTab}
              className="btn btn-secondary"
              disabled={isFirstTab}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', opacity: isFirstTab ? 0.5 : 1 }}
            >
              <ChevronLeft size={16} /> Previous Step
            </button>
          </div>

          <div className="employee-footer-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>

            {!isLastTab && (
              <button
                type="button"
                onClick={handleNextTab}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
              >
                Next Step <ChevronRight size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
            >
              <CheckCircle2 size={16} />
              {loading ? 'Saving Employee...' : (isEdit ? 'Save Changes' : 'Create Employee')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
