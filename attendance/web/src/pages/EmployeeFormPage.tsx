import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { EmployeeForm } from '../components/EmployeeForm';
import { ArrowLeft } from 'lucide-react';
import './EmployeeFormPage.css';

const EmployeeFormPage = () => {
  const navigate = useNavigate();
  const { id, companySlug } = useParams<{ id?: string; companySlug?: string }>();
  const location = useLocation();
  const employeeId = id ? Number(id) : undefined;

  // Compute return route based on current path
  const employeesRoute = companySlug
    ? `/${encodeURIComponent(companySlug)}/hr/employees`
    : location.pathname.startsWith('/super-admin')
      ? '/super-admin/employees'
      : '/admin/employees';

  if (id && (!Number.isInteger(employeeId) || Number(employeeId) <= 0)) {
    return (
      <main className="employee-page-fullwidth">
        <p className="employee-page-error-message">Invalid employee ID.</p>
        <button
          type="button"
          className="btn btn-secondary employee-page-back-btn"
          onClick={() => navigate(employeesRoute)}
        >
          <ArrowLeft size={16} /> Back to Employees
        </button>
      </main>
    );
  }

  return (
    <main className="employee-page-fullwidth">
      <div className="employee-page-top-bar">
        <button
          type="button"
          className="btn btn-secondary employee-page-back-btn"
          onClick={() => navigate(employeesRoute)}
        >
          <ArrowLeft size={16} /> Back to Employees
        </button>
      </div>

      <EmployeeForm
        employeeId={employeeId}
        pageMode
        onClose={() => navigate(employeesRoute)}
        onSuccess={() => navigate(employeesRoute)}
      />
    </main>
  );
};

export default EmployeeFormPage;
