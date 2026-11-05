import { useEffect, useRef, useState } from "react";
import { getLeaves, approveLeave, rejectLeave } from '../api/leaves';
import { getPermissions, approvePermission, rejectPermission } from '../api/permissions';
import { Camera, Users, CheckCircle, Clock, XCircle, BarChart3, MapPin, Building2, RefreshCw, AlertCircle, PieChart as PieChartIcon, CalendarDays, ArrowUpRight } from "lucide-react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, Area } from "recharts";
import { CustomSelect } from "../components/CustomSelect";
import { CustomDatePicker } from "../components/CustomDatePicker";
import api from "../services/api";
import { formatTimeAMPM } from "../utils/timeUtils";
import { useNavigate } from "react-router-dom";

interface DashboardSummary { total_employees:number; present:number; late:number; working:number; completed:number; absent:number; pending:number; approved:number; rejected:number; }
interface AttendanceTrend { date:string; present:number; late:number; absent:number; }
interface StatusDistribution { name:string; value:number; }
interface BaseSummary { total_employees:number; present:number; late:number; working:number; absent:number; }
interface BranchSummary extends BaseSummary { branch_name:string; }
interface CompanySummary extends BaseSummary { company_name:string; }
interface DeptSummary extends BaseSummary { department:string; }

interface DashboardLeave {
  id: number;
  employee_name?: string;
  employee_id?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
}

interface DashboardPermission {
  id: number;
  employee_name?: string;
  employee_id?: string;
  date: string;
  duration_minutes: number;
  reason: string;
  status: string;
}
interface DashboardData { start_date:string; end_date:string; summary:DashboardSummary; attendance_trend:AttendanceTrend[]; status_distribution:StatusDistribution[]; branch_summary:BranchSummary[]; company_summary:CompanySummary[]; department_summary:DeptSummary[]; recent_attendance:any[]; }

const lateText=(m:number)=>{if(!m||m<=0)return"On time";const h=Math.floor(m/60),r=m%60;return h&&r?`${h}h ${r}m`:h?`${h}h`:`${r}m`};
const statusColor=(s:string)=>({ON_TIME:"#0056B3",COMPLETED:"#0056B3",APPROVED:"#0056B3",LATE:"#D97706",WORKING:"#2563EB",ABSENT:"#DC2626",REJECTED:"#DC2626"}[s]||"#64748B");
const chartColors=["#0056B3","#F59E0B","#2563EB","#8B5CF6","#94A3B8","#EF4444"];

export const Dashboard=()=>{
 const navigate=useNavigate(); const [data,setData]=useState<DashboardData|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(false);
  const [leaveRequests, setLeaveRequests] = useState<DashboardLeave[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<DashboardPermission[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);
 const today=new Date().toISOString().split("T")[0]; const [dateFilter,setDateFilter]=useState(today); const [trendPeriod,setTrendPeriod]=useState("7d");
 const [companies,setCompanies]=useState<any[]>([]); const [branches,setBranches]=useState<any[]>([]); const [selectedCompany,setSelectedCompany]=useState(""); const [selectedBranch,setSelectedBranch]=useState("");
 useEffect(()=>{(async()=>{try{const [c,b]=await Promise.all([api.get("/companies/"),api.get("/branches/")]);setCompanies(c.data.results||c.data);setBranches(b.data.results||b.data)}catch(e){console.error(e)}})()},[]);

const fetchLeavePermissionUpdates = async () => {
  setLeaveLoading(true);
  setPermissionLoading(true);

  try {
    const [leaves, permissions] = await Promise.all([
      getLeaves(),
      getPermissions(),
    ]);

    const leaveData = Array.isArray(leaves)
      ? leaves
      : leaves?.results || leaves?.data || [];

    const permissionData = Array.isArray(permissions)
      ? permissions
      : permissions?.results || permissions?.data || [];

    setLeaveRequests(leaveData);
    setPermissionRequests(permissionData);
  } catch (error) {
    console.error('Failed to load leave/permission updates:', error);
  } finally {
    setLeaveLoading(false);
    setPermissionLoading(false);
  }
};

useEffect(() => {
  fetchLeavePermissionUpdates();
}, []);

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

 const fetchRequestId = useRef(0);

 const fetchDashboard = async () => {
   const requestId = ++fetchRequestId.current;
   setLoading(true);
   setError(false);

   try {
     const params: Record<string, string> = {
       date: dateFilter,
       trend_period: trendPeriod,
     };

     if (selectedCompany) params.company = selectedCompany;
     if (selectedBranch) params.branch = selectedBranch;

     console.log("[Dashboard] Fetching selected date:", dateFilter, params);

     const response = await api.get("/attendance/dashboard/", { params });

     if (requestId !== fetchRequestId.current) return;

     console.log("[Dashboard] Response:", {
       requestedDate: dateFilter,
       startDate: response.data?.start_date,
       endDate: response.data?.end_date,
       summary: response.data?.summary,
     });

     setData(response.data);
   } catch (e) {
     if (requestId !== fetchRequestId.current) return;
     console.error("[Dashboard] Failed to load selected date:", e);
     setError(true);
   } finally {
     if (requestId === fetchRequestId.current) setLoading(false);
   }
 };

 useEffect(() => {
   fetchDashboard();
 }, [dateFilter, trendPeriod, selectedCompany, selectedBranch]);
 const userStr=localStorage.getItem("user"); const user=userStr?JSON.parse(userStr):null; const adminName=user?.username||"Admin";
 const filteredBranches=selectedCompany?branches.filter(b=>b.company===parseInt(selectedCompany)||b.company?.id===parseInt(selectedCompany)):branches;
const getAttendanceBranchName = (attendance: any) => {
  const branch = attendance?.employee?.branch;

  if (typeof branch === 'string' && branch.trim()) {
    return branch;
  }

  if (branch && typeof branch === 'object') {
    return branch.branch_name || branch.name || branch.title || '--';
  }

  return '--';
};
 const rate=data&&data.summary.total_employees>0?((data.summary.present/data.summary.total_employees)*100).toFixed(1):"0.0";
 const dateLabel=new Date(`${dateFilter}T00:00:00`).toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short",year:"numeric"});
 const trendDate=(s:string)=>new Date(s).toLocaleDateString("en-GB",{day:"2-digit",month:"short"});

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

 return <div className="attendance-dashboard"><style>{`
.request-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:40px;margin-bottom:24px}
.request-card{background:#fff;border:1px solid rgba(6, 27, 58, 0.08);border-radius:18px;box-shadow:0 5px 18px rgba(15,36,24,.045);overflow:hidden}
.request-head{display:flex;justify-content:space-between;align-items:center;padding:18px 21px;border-bottom:1px solid rgba(6, 27, 58, 0.04)}
.request-title{font-size:15px;font-weight:800;color:#0D1B2A}
.request-sub{font-size:10px;color:#8E9BAE;margin-top:3px}
.request-list{padding:4px 21px}
.request-item{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-bottom:1px solid rgba(6, 27, 58, 0.04)}
.request-item:last-child{border-bottom:0}
.request-employee{display:flex;align-items:center;gap:10px;min-width:0}
.request-info{min-width:0}
.request-name{font-size:12px;font-weight:800;color:#0D1B2A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.request-meta{font-size:10px;color:#8E9BAE;margin-top:3px}
.request-right{text-align:right;flex:none}
.request-date{font-size:10px;color:#5A6A80;margin-bottom:5px}
.request-empty{padding:35px 10px;text-align:center;color:#8E9BAE;font-size:12px}
.request-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase}
.approval-panel{background:#fff;border:1px solid rgba(6, 27, 58, 0.08);border-radius:18px;box-shadow:0 5px 18px rgba(15,36,24,.045);overflow:hidden;margin-bottom:16px}
.approval-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:17px 21px;border-bottom:1px solid rgba(6, 27, 58, 0.04)}
.approval-row:last-child{border-bottom:0}
.approval-main{min-width:0;flex:1}
.approval-details{font-size:11px;color:#5A6A80;margin-top:5px;line-height:1.6;overflow-wrap:anywhere}
.approval-actions{display:flex;gap:8px;flex-shrink:0}
.approval-btn{border:0;border-radius:8px;padding:9px 12px;font-size:11px;font-weight:800;cursor:pointer}
.approval-btn:disabled{opacity:.55;cursor:not-allowed}
.approval-approve{background:rgba(0, 86, 179, 0.08);color:#0056B3}
.approval-reject{background:#FEF2F2;color:#DC2626}
.approval-feedback{padding:10px 21px;font-size:12px;font-weight:700}
.approval-success{color:#0056B3}
.approval-error{color:#DC2626}
@media(max-width:600px){.approval-row{flex-direction:column}.approval-actions{width:100%}.approval-btn{flex:1}}

@media(max-width:760px){.request-grid{grid-template-columns:1fr}}
 .attendance-dashboard{min-height:100%;padding:28px 32px 40px;background:#F8F9FC;color:#0D1B2A}.dash-shell{max-width:1600px;margin:auto}.dash-top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:20px}.eyebrow{display:flex;align-items:center;gap:6px;color:#0056B3;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px}.title{margin:0;font-size:36px;line-height:1.1;font-weight:850;letter-spacing:-.035em}.subtitle{margin:7px 0 0;color:#5A6A80;font-size:14px}.date-pill{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid rgba(6, 27, 58, 0.08);border-radius:12px;padding:11px 14px;font-size:12px;font-weight:700;white-space:nowrap}.hero{position:relative;overflow:hidden;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:28px 30px;margin-bottom:16px;border-radius:20px;background:linear-gradient(135deg,#0056B3,#014B9D 65%,#061B3A);color:#fff;box-shadow:0 14px 32px rgba(0,86,179,.25)}.hero:after{content:"";position:absolute;width:330px;height:330px;border:1px solid rgba(255,255,255,.12);border-radius:50%;right:-80px;top:-190px}.hero-copy,.hero-rate{position:relative;z-index:1}.hero h2{margin:0 0 7px;font-size:30px;font-weight:850;letter-spacing:-.03em}.hero p{margin:0;max-width:620px;color:rgba(255,255,255,.82);font-size:14px;line-height:1.6}.hero-rate{min-width:200px;padding:17px 19px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.12);border-radius:16px}.hero-rate small{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.76)}.hero-rate strong{display:block;margin-top:4px;font-size:34px}.filters{display:flex;align-items:center;gap:10px;padding:11px;margin-bottom:16px;background:#fff;border:1px solid rgba(6, 27, 58, 0.08);border-radius:16px;box-shadow:0 5px 18px rgba(15,36,24,.04)}.filter-date{min-width:190px}.filter-select{min-width:200px}.refresh{margin-left:auto;width:42px;height:42px;border:1px solid rgba(6, 27, 58, 0.08);border-radius:11px;background:#FFFFFF;color:#416052;display:flex;align-items:center;justify-content:center;cursor:pointer}.refresh:hover{background:rgba(0, 86, 179, 0.08);color:#0056B3}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;margin-bottom:16px}.card{background:#fff;border:1px solid rgba(6, 27, 58, 0.08);border-radius:18px;box-shadow:0 5px 18px rgba(15,36,24,.045);overflow:hidden}.kpi{grid-column:span 2;padding:18px;min-height:145px}.kpi-icon{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:15px}.kpi-label{font-size:12px;font-weight:700;color:#617268}.kpi-value{font-size:28px;font-weight:850;line-height:1;margin-top:4px}.kpi-sub{font-size:10px;color:#8E9BAE;margin-top:10px}.chart{grid-column:span 8;padding:21px;min-height:360px}.side{grid-column:span 4;padding:21px;min-height:360px}.dept{grid-column:span 4;padding:21px;min-height:320px}.wide{grid-column:span 8;padding:21px;min-height:320px}.head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:18px}.head-left{display:flex;align-items:center;gap:10px}.head-icon{width:37px;height:37px;border-radius:11px;background:rgba(0, 86, 179, 0.08);color:#0056B3;display:flex;align-items:center;justify-content:center}.head h3{margin:0;font-size:15px;font-weight:800}.head p{margin:3px 0 0;color:#8E9BAE;font-size:10px}.period{width:145px}.dept-list{display:flex;flex-direction:column;gap:18px;max-height:250px;overflow:auto}.dept-head{display:flex;justify-content:space-between;margin-bottom:7px;font-size:12px}.dept-name{font-weight:700;color:#0D1B2A}.dept-rate{font-weight:800;color:#0056B3}.track{height:7px;background:rgba(0, 86, 179, 0.08);border-radius:99px;overflow:hidden}.fill{height:100%;border-radius:inherit}.table-wrap{width:100%;overflow:auto}.table{width:100%;min-width:600px;border-collapse:collapse;font-size:12px}.table th{padding:11px 13px;background:#F8F9FC;color:#5A6A80;border-bottom:1px solid rgba(6, 27, 58, 0.08);text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.table td{padding:13px;color:#2A3B4C;border-bottom:1px solid rgba(6, 27, 58, 0.04);font-weight:600}.table tr:last-child td{border:0}.emp{display:flex;align-items:center;gap:9px}.avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0, 86, 179, 0.08);color:#0056B3;font-size:11px;font-weight:800;flex:none}.emp-name{font-weight:800;color:#0D1B2A}.emp-id{font-size:10px;color:#8E9BAE;margin-top:2px}.pill{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase}.branch-rate{display:flex;align-items:center;justify-content:flex-end;gap:8px}.mini{width:55px;height:6px;background:rgba(0, 86, 179, 0.08);border-radius:99px;overflow:hidden}.mini span{display:block;height:100%}.view{display:flex;align-items:center;gap:4px;color:#0056B3;font-size:11px;font-weight:800;cursor:pointer}.empty{height:180px;display:flex;align-items:center;justify-content:center;color:#8E9BAE;font-size:13px}.state{padding:70px 20px;text-align:center;background:#fff;border:1px solid rgba(6, 27, 58, 0.08);border-radius:18px;color:#5A6A80}.error{color:#B91C1C}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
 @media(max-width:1280px){.kpi{grid-column:span 4}.chart{grid-column:span 8}.side{grid-column:span 4}.dept{grid-column:span 5}.wide{grid-column:span 7}}@media(max-width:1024px){.attendance-dashboard{padding:22px 20px 32px}.dash-top{align-items:flex-start;flex-direction:column}.chart,.side,.dept,.wide{grid-column:span 12}}@media(max-width:760px){.attendance-dashboard{padding:16px 14px 28px}.title{font-size:28px}.hero{padding:22px;flex-direction:column;align-items:stretch}.hero-rate{min-width:0}.filters{flex-direction:column;align-items:stretch}.filter-date,.filter-select{width:100%;min-width:0}.refresh{width:100%;margin:0}.kpi{grid-column:span 6}}@media(max-width:480px){.kpi{grid-column:span 12}.chart,.side,.dept,.wide{padding:17px}.date-pill{width:100%}}
 `}</style>
 <div className="dash-shell">
  <div className="dash-top"><div><div className="eyebrow">
  <Camera size={14} strokeWidth={2.5} />
  <span>Attendance Management</span>
</div><h1 className="title">Dashboard</h1><p className="subtitle">Monitor your workforce attendance and daily performance.</p></div><div className="date-pill"><CalendarDays size={16} color="#0056B3"/>{dateLabel}</div></div>
  <div className="hero"><div className="hero-copy"><h2>Good Morning, {adminName}!</h2><p>Here&apos;s your attendance overview. Track employees, branches, departments and today&apos;s workforce activity from one place.</p></div><div className="hero-rate"><small>Today&apos;s Attendance Rate</small><strong>{rate}%</strong></div></div>
  <div className="filters"><div className="filter-date"><CustomDatePicker value={dateFilter} onChange={setDateFilter}/></div><div className="filter-select"><CustomSelect options={[{value:"",label:"All Companies"},...companies.map(c=>({value:String(c.id),label:c.name}))]} value={selectedCompany} onChange={v=>{setSelectedCompany(v);setSelectedBranch("")}} placeholder="All Companies" icon={<Building2 size={17}/>} searchPlaceholder="Search companies..."/></div><div className="filter-select"><CustomSelect options={[{value:"",label:"All Branches"},...filteredBranches.map(b=>({value:String(b.id),label:b.branch_name||b.name}))]} value={selectedBranch} onChange={setSelectedBranch} placeholder="All Branches" icon={<MapPin size={17}/>} searchPlaceholder="Search branches..."/></div><button className="refresh" onClick={fetchDashboard} title="Refresh" type="button"><RefreshCw size={18} className={loading?"spin":""}/></button></div>
  {loading&&!data?<div className="state">Loading dashboard...</div>:error||!data?<div className="state error">Failed to load dashboard data. Please refresh and try again.</div>:<>
   <div className="grid">{[
    ["Total Employees",data.summary.total_employees,"Active workforce",<Users size={19}/>,"rgba(0, 86, 179, 0.08)","#0056B3"],
    ["Present",data.summary.present,"Checked in",<CheckCircle size={19}/>,"rgba(0,86,179,0.08)","#0056B3"],
    ["Working",data.summary.working,"Currently working",<Clock size={19}/>,"#EFF6FF","#2563EB"],
    ["Late",data.summary.late,"Late Punch Ins",<AlertCircle size={19}/>,"#FFF7E6","#D97706"],
    ["Absent",data.summary.absent,"No attendance",<XCircle size={19}/>,"#FEF2F2","#DC2626"],
    ["Completed",data.summary.completed,"Shift finished",<CheckCircle size={19}/>,"#F3F0FF","#7C3AED"]
   ].map(([label,value,sub,icon,bg,color])=><div className="card kpi" key={String(label)}><div className="kpi-icon" style={{background:bg as string,color:color as string}}>{icon}</div><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className="kpi-sub">{sub}</div></div>)}</div>
    <div className="request-grid">
      <div className="request-card">
        <div className="request-head">
          <div>
            <div className="request-title">Leave Updates</div>
            <div className="request-sub">Latest employee leave requests</div>
          </div>
          <div className="view" onClick={() => navigate("/admin/leaves")}>View All <ArrowUpRight size={14}/></div>
        </div>
        <div className="request-list">
          {leaveLoading ? (
            <div className="request-empty">Loading leave requests...</div>
          ) : !leaveRequests.length ? (
            <div className="request-empty">No leave requests</div>
          ) : leaveRequests.slice(0, 5).map((leave) => {
            const status = String(leave.status || "PENDING").toUpperCase();
            const statusColor = status === "APPROVED" ? "#0056B3" : status === "REJECTED" ? "#DC2626" : "#D97706";
            return (
              <div className="request-item" key={`leave-${leave.id}`}>
                <div className="request-employee">
                  <div className="avatar">{leave.employee_name?.[0]?.toUpperCase() || "E"}</div>
                  <div className="request-info">
                    <div className="request-name">{leave.employee_name || "Employee"}</div>
                    <div className="request-meta">{leave.employee_id || "--"}  {leave.leave_type}</div>
                  </div>
                </div>
                <div className="request-right">
                  <div className="request-date">{leave.start_date}  {leave.end_date}</div>
                  <span className="request-status" style={{color:statusColor,background:`${statusColor}12`}}>{status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="request-card">
        <div className="request-head">
          <div>
            <div className="request-title">Permission Updates</div>
            <div className="request-sub">Latest employee permission requests</div>
          </div>
          <div className="view" onClick={() => navigate("/admin/permissions")}>View All <ArrowUpRight size={14}/></div>
        </div>
        <div className="request-list">
          {permissionLoading ? (
            <div className="request-empty">Loading permission requests...</div>
          ) : !permissionRequests.length ? (
            <div className="request-empty">No permission requests</div>
          ) : permissionRequests.slice(0, 5).map((permission) => {
            const status = String(permission.status || "PENDING").toUpperCase();
            const statusColor = status === "APPROVED" ? "#0056B3" : status === "REJECTED" ? "#DC2626" : "#D97706";
            return (
              <div className="request-item" key={`permission-${permission.id}`}>
                <div className="request-employee">
                  <div className="avatar">{permission.employee_name?.[0]?.toUpperCase() || "E"}</div>
                  <div className="request-info">
                    <div className="request-name">{permission.employee_name || "Employee"}</div>
                    <div className="request-meta">{permission.employee_id || "--"}  {permission.duration_minutes} min</div>
                  </div>
                </div>
                <div className="request-right">
                  <div className="request-date">{permission.date}</div>
                  <span className="request-status" style={{color:statusColor,background:`${statusColor}12`}}>{status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
   <div className="card wide" style={{gridColumn:"span 12",padding:21,marginBottom:32}}><div className="head"><div className="head-left"><div className="head-icon"><Clock size={19}/></div><div><h3>Recent Attendance</h3><p>Latest employee Punch In and Punch Out activity</p></div></div><div className="view" onClick={()=>navigate("/admin/attendance")}>View All <ArrowUpRight size={14}/></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Employee</th><th>Branch</th><th>Time In</th><th>Time Out</th><th>Status</th></tr></thead><tbody>{!data.recent_attendance.length?<tr><td colSpan={5}><div className="empty">No recent attendance</div></td></tr>:data.recent_attendance.slice(0,5).map((att:any)=><tr key={att.id}><td><div className="emp"><div className="avatar">{att.employee?.full_name?.[0]?.toUpperCase()||"E"}</div><div><div className="emp-name">{att.employee?.full_name||"Employee"}</div><div className="emp-id">{att.employee?.employee_id||"--"}</div></div></div></td><td>{getAttendanceBranchName(att)}</td><td>{att.check_in_time?formatTimeAMPM(att.check_in_time):"--"}{att.late_minutes>0&&<div style={{fontSize:10,color:"#D97706",marginTop:3}}>{lateText(att.late_minutes)} late</div>}</td><td>{att.check_out_time?formatTimeAMPM(att.check_out_time):"--"}</td><td><span className="pill" style={{color:statusColor(att.status),background:`${statusColor(att.status)}12`}}>{String(att.status||"--").replace("_"," ")}</span></td></tr>)}</tbody></table></div></div>

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

   <div className="grid">
    <div className="card chart"><div className="head"><div className="head-left"><div className="head-icon"><BarChart3 size={19}/></div><div><h3>Attendance Overview</h3><p>Attendance trend for the selected period</p></div></div><div className="period"><CustomSelect options={[{value:"today",label:"Today"},{value:"7d",label:"Last 7 Days"},{value:"30d",label:"Last 30 Days"},{value:"this_month",label:"This Month"}]} value={trendPeriod} onChange={setTrendPeriod}/></div></div><div style={{width:"100%",height:270}}><ResponsiveContainer><ComposedChart data={data.attendance_trend} margin={{top:10,right:10,left:-20,bottom:0}}><defs><linearGradient id="greenArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0056B3" stopOpacity={.22}/><stop offset="95%" stopColor="#0056B3" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(6, 27, 58, 0.08)"/><XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={trendDate} tick={{fontSize:11,fill:"#5A6A80"}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:"#5A6A80"}}/><RechartsTooltip contentStyle={{borderRadius:12,border:"1px solid rgba(6, 27, 58, 0.08)",fontSize:12}}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/><Area type="monotone" dataKey="present" name="Present" stroke="#0056B3" fill="url(#greenArea)" legendType="none"/><Bar dataKey="present" name="Present" fill="#0056B3" radius={[4,4,0,0]} barSize={10}/><Bar dataKey="late" name="Late" fill="#F59E0B" radius={[4,4,0,0]} barSize={10}/><Line type="monotone" dataKey="absent" name="Absent" stroke="#EF4444" strokeWidth={2} dot={{r:3}}/></ComposedChart></ResponsiveContainer></div></div>
    <div className="card side"><div className="head"><div className="head-left"><div className="head-icon"><PieChartIcon size={19}/></div><div><h3>Status Distribution</h3><p>Current attendance status</p></div></div></div><div style={{position:"relative",height:185}}><ResponsiveContainer><PieChart><Pie data={data.status_distribution} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">{data.status_distribution.map((_e,i)=><Cell key={i} fill={chartColors[i%chartColors.length]}/>)}</Pie><RechartsTooltip/></PieChart></ResponsiveContainer><div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><strong style={{fontSize:25}}>{data.summary.total_employees}</strong><span style={{fontSize:10,color:"#87958D"}}>Total Employees</span></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 18px",marginTop:7}}>{data.status_distribution.map((item,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:11}}><span style={{width:8,height:8,borderRadius:"50%",background:chartColors[i%chartColors.length]}}/><span style={{color:"#5A6A80",flex:1}}>{item.name}</span><b>{item.value}</b></div>)}</div></div>
   </div>
   <div className="grid">
    <div className="card dept"><div className="head"><div className="head-left"><div className="head-icon"><Users size={19}/></div><div><h3>Department Attendance</h3><p>Attendance rate by department</p></div></div></div><div className="dept-list">{!data.department_summary.length?<div className="empty">No departments found</div>:data.department_summary.map((d,i)=>{const r=d.total_employees?Math.round(d.present/d.total_employees*100):0;const c=r>=80?"#0056B3":r>=60?"#F59E0B":"#EF4444";return <div key={i}><div className="dept-head"><span className="dept-name">{d.department}</span><span className="dept-rate" style={{color:c}}>{r}%</span></div><div className="track"><div className="fill" style={{width:`${r}%`,background:c}}/></div><div style={{fontSize:10,color:"#94A099",marginTop:5}}>{d.present} present of {d.total_employees}</div></div>})}</div></div>
    <div className="card wide"><div className="head"><div className="head-left"><div className="head-icon"><MapPin size={19}/></div><div><h3>Branch Attendance</h3><p>Attendance performance by branch</p></div></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Branch</th><th>Total</th><th>Present</th><th>Late</th><th>Absent</th><th>Working</th><th style={{textAlign:"right"}}>Rate</th></tr></thead><tbody>{!data.branch_summary.length?<tr><td colSpan={7}><div className="empty">No branches found</div></td></tr>:data.branch_summary.slice(0,5).map((b,i)=>{const r=b.total_employees?Math.round(b.present/b.total_employees*100):0;const c=r>=80?"#0056B3":r>=60?"#F59E0B":"#EF4444";return <tr key={i}><td>{b.branch_name}</td><td>{b.total_employees}</td><td>{b.present}</td><td style={{color:"#D97706"}}>{b.late}</td><td style={{color:"#DC2626"}}>{b.absent}</td><td>{b.working}</td><td><div className="branch-rate"><div className="mini"><span style={{width:`${r}%`,background:c}}/></div><b style={{color:c}}>{r}%</b></div></td></tr>})}</tbody></table></div></div>
   </div>


  </>}
 </div></div>;
};
export default Dashboard;







