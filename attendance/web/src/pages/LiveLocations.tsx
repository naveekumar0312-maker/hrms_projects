import L from 'leaflet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import {
  Activity,
  LocateFixed,
  RefreshCw,
  Clock3,
  MapPin,
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Play,
  Pause,
  Route,
  History,
} from 'lucide-react';
import api from '../api';
import { employeeService } from '../services/employeeService';
import 'leaflet/dist/leaflet.css';
import './LiveLocations.css';

interface EmployeeProfile {
  id: number;
  employee_id: string;
  full_name: string;
  designation: string | null;
  department: string | null;
  branch_name?: string | null;
  branch?: any;
  work_type?: string | null;
  status?: boolean;
}

interface EmployeeLocation {
  id: number;
  employee_id: string;
  employee_name: string;
  designation: string | null;
  department: string | null;
  branch: string | null;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
}

interface LiveResponse {
  count?: number;
  results?: EmployeeLocation[];
}

interface TrackingHistoryRecord {
  id: number;
  employee_id: string;
  employee_name: string;
  designation?: string | null;
  department?: string | null;
  branch?: string | null;
  type?: string;
  event_type?: string;
  details?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  recorded_at: string;
  stop_duration_seconds?: number | null;
  stop_duration_minutes?: number | null;
  elapsed_seconds?: number | null;
  duration_method?: string | null;
}

interface HistoryResponse {
  employee_id?: string;
  employee_name?: string;
  count?: number;
  results?: TrackingHistoryRecord[];
}

type MapPoint = {
  latitude: number;
  longitude: number;
  recorded_at: string;
  employee_name?: string;
};

type GpsHistoryRecord = TrackingHistoryRecord & {
  latitude: number;
  longitude: number;
};

function isGpsHistoryRecord(point: TrackingHistoryRecord): point is GpsHistoryRecord {
  const kind = String(point.event_type || point.type || '').toUpperCase();
  return (
    (!kind || kind === 'GPS') &&
    typeof point.latitude === 'number' &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === 'number' &&
    Number.isFinite(point.longitude)
  );
}
function MapFocus({ point }: { point: MapPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo([point.latitude, point.longitude], 15, { duration: 0.7 });
  }, [point?.latitude, point?.longitude, map]);
  return null;
}
function MapControls({
  point,
  routePositions,
}: {
  point: MapPoint | null;
  routePositions: [number, number][];
}) {
  const map = useMap();

  const recenter = () => {
    if (point) {
      map.flyTo([point.latitude, point.longitude], 15, { duration: 0.7 });
    }
  };

  const fitRoute = () => {
    if (routePositions.length > 1) {
      map.fitBounds(routePositions, {
        padding: [40, 40],
        maxZoom: 16,
        animate: true,
      });
    } else if (point) {
      map.flyTo([point.latitude, point.longitude], 15, { duration: 0.7 });
    }
  };

  return (
    <div className="live-map-floating-controls">
      <button type="button" onClick={recenter} disabled={!point} title="Recenter on selected location">
        <LocateFixed size={16} />
        <span>Recenter</span>
      </button>
      <button type="button" onClick={fitRoute} disabled={!point && routePositions.length === 0} title="Fit the complete route">
        <Route size={16} />
        <span>Fit route</span>
      </button>
    </div>
  );
}

function safeDisplayText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    for (const key of ['name', 'label', 'title', 'display_name', 'message', 'details']) {
      if (typeof item[key] === 'string') return item[key] as string;
    }
  }
  return fallback;
}
function formatTime(value: string, withDate = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-IN', withDate
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }
    : { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function employeeName(employee: EmployeeProfile) {
  return employee.full_name || employee.employee_id || `Employee ${employee.id}`;
}

function getEmployeeBranch(employee: EmployeeProfile | null | undefined): string {
  if (!employee) return '-';
  if (typeof employee.branch === 'string' && employee.branch.trim()) return employee.branch.trim();
  if (employee.branch && typeof employee.branch === 'object' && employee.branch.branch_name) {
    return String(employee.branch.branch_name).trim();
  }
  if (employee.branch_name && typeof employee.branch_name === 'string') {
    return employee.branch_name.trim();
  }
  return '-';
}

type CustomOption = {
  value: string;
  label: string;
};

function CustomSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  searchable = false,
  loading = false,
  emptyLabel = 'No options found',
}: {
  label: string;
  value: string;
  options: CustomOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  searchable?: boolean;
  loading?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = options.find((item) => item.value === value);
  const filteredOptions = options.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="live-custom-field">
      <span className="live-custom-label">{label}</span>
      <div className="live-custom-select">
        <button
          type="button"
          className="live-custom-trigger"
          disabled={disabled}
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
            setQuery('');
          }}
        >
          <span>{loading ? 'Loading employees...' : selectedOption?.label || emptyLabel}</span>
          <ChevronDown size={15} />
        </button>

        {open && !disabled && (
          <>
            <button
              type="button"
              className="live-custom-dismiss"
              aria-label="Close dropdown"
              onClick={() => setOpen(false)}
            />
            <div className="live-custom-menu">
              {searchable && (
                <div className="live-custom-search">
                  <Search size={15} />
                  <input
                    autoFocus
                    value={query}
                    placeholder="Search employees..."
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              )}

              <div className="live-custom-options">
                {filteredOptions.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`live-custom-option ${option.value === value ? 'is-selected' : ''}`}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span>{option.label}</span>
                    {option.value === value && <span className="live-option-check"></span>}
                  </button>
                ))}
                {filteredOptions.length === 0 && (
                  <div className="live-custom-empty">
                    {loading ? 'Loading employees...' : emptyLabel}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CustomDatePicker({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  const parseDate = (input: string) => {
    const parts = input.split('-').map(Number);
    return parts.length === 3 && parts.every(Number.isFinite)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  };

  const toDateString = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDate(value));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : index - firstWeekday + 1
  );

  const isDisabled = (day: number) => {
    const date = toDateString(new Date(year, month, day));
    return Boolean((min && date < min) || (max && date > max));
  };

  return (
    <div className="live-custom-field">
      <span className="live-custom-label">
        <CalendarDays size={14} />
        {label}
      </span>
      <div className="live-custom-select">
        <button
          type="button"
          className="live-custom-trigger live-date-trigger"
          aria-expanded={open}
          onClick={() => {
            setViewDate(parseDate(value));
            setOpen((current) => !current);
          }}
        >
          <span>{value ? parseDate(value).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) : 'Select date'}</span>
          <CalendarDays size={15} />
        </button>

        {open && (
          <>
            <button
              type="button"
              className="live-custom-dismiss"
              aria-label="Close calendar"
              onClick={() => setOpen(false)}
            />
            <div className="live-custom-calendar">
              <div className="live-calendar-heading">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setViewDate(new Date(year, month - 1, 1))}
                >
                  <ChevronLeft size={17} />
                </button>
                <strong>
                  {viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </strong>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setViewDate(new Date(year, month + 1, 1))}
                >
                  <ChevronRight size={17} />
                </button>
              </div>

              <div className="live-calendar-grid">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <span key={day} className="live-calendar-weekday">{day}</span>
                ))}
                {cells.map((day, index) => {
                  if (day === null) {
                    return <span key={`empty-${index}`} className="live-calendar-blank" />;
                  }

                  const date = toDateString(new Date(year, month, day));
                  const selectedDay = date === value;

                  return (
                    <button
                      type="button"
                      key={date}
                      disabled={isDisabled(day)}
                      className={`live-calendar-day ${selectedDay ? 'is-selected' : ''}`}
                      onClick={() => {
                        onChange(date);
                        setOpen(false);
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="live-calendar-today"
                onClick={() => {
                  const today = toDateString(new Date());
                  if ((!min || today >= min) && (!max || today <= max)) {
                    onChange(today);
                    setViewDate(parseDate(today));
                    setOpen(false);
                  }
                }}
              >
                Today
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


const LiveLocations: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [selected, setSelected] = useState<EmployeeProfile | null>(null);
  const [history, setHistory] = useState<TrackingHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyRequestId = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [employeesError, setEmployeesError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [fromDate, setFromDate] = useState(localDateValue(new Date()));
  const [toDate, setToDate] = useState(localDateValue(new Date()));
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animatedPosition, setAnimatedPosition] = useState<[number, number] | null>(null);
  const [locationName, setLocationName] = useState('Location unavailable');
  const [focusedTimelinePoint, setFocusedTimelinePoint] = useState<MapPoint | null>(null);

  const loadEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const response = await employeeService.getEmployees();
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
      const activeRows = rows.filter((item: EmployeeProfile) => item.status !== false);
      setEmployees(activeRows);
      setEmployeesError('');
      setSelected((current) => {
        if (current && activeRows.some((item: EmployeeProfile) => item.id === current.id)) {
          return activeRows.find((item: EmployeeProfile) => item.id === current.id) || current;
        }
        return activeRows[0] || null;
      });
    } catch (err: any) {
      setEmployeesError(err?.response?.data?.detail || 'Unable to load the employee master list.');
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  const loadLocations = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await api.get<LiveResponse | EmployeeLocation[]>('/tracking/live/');
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
      setLocations(rows);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to load live locations. Check your login and tracking API.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const filteredEmployees = useMemo(() => employees.filter((item) => {
    const workType = (item.work_type || '').trim().toUpperCase();
    return ['FIELD', 'MARKETING'].includes(workType);
  }), [employees]);

  const selectedLiveLocation = useMemo(
    () => selected ? locations.find((item) => item.id === selected.id || item.employee_id === selected.employee_id) || null : null,
    [locations, selected]
  );

  const loadHistory = useCallback(async (employee: EmployeeProfile) => {
    const requestId = ++historyRequestId.current;

    setHistoryLoading(true);
    setHistoryError('');
    setIsPlaying(false);
    setHistory([]);

    try {
      const response = await api.get<HistoryResponse | TrackingHistoryRecord[]>(
        `/tracking/history/${Number(employee.id)}/?limit=200`
      );

      if (requestId !== historyRequestId.current) return;

      const payload = response.data;
      const rows: TrackingHistoryRecord[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.results)
          ? payload.results
          : [];

      const sorted = [...rows].sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() -
          new Date(b.recorded_at).getTime()
      );

      setHistory(sorted);
      setPlaybackIndex(Math.max(0, sorted.length - 1));

      if (sorted.length === 0) {
        setHistoryError('No location history or tracking events were found for this employee.');
      }
    } catch (err: any) {
      if (requestId !== historyRequestId.current) return;

      setHistory([]);
      setHistoryError(
        err?.response?.data?.detail ||
        'Unable to load location history. Confirm tracking API permissions and employee ID.'
      );
    } finally {
      if (requestId === historyRequestId.current) {
        setHistoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
    void loadLocations();
    const timer = window.setInterval(() => void loadLocations(), 30000);
    return () => window.clearInterval(timer);
  }, [loadEmployees, loadLocations]);

  useEffect(() => {
    if (selected) void loadHistory(selected);
    else {
      setHistory([]);
      setHistoryError('');
    }
  }, [selected?.id, loadHistory]);

  useEffect(() => {
    if (filteredEmployees.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !filteredEmployees.some((employee) => employee.id === selected.id)) {
      setSelected(filteredEmployees[0]);
    }
  }, [filteredEmployees, selected]);

  const filteredHistory = useMemo(() => {
    const start = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity;
    const end = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Infinity;
    if (start > end) return [];
    return history.filter((point) => {
      const time = new Date(point.recorded_at).getTime();
      return time >= start && time <= end;
    });
  }, [history, fromDate, toDate]);
  const gpsFilteredHistory = useMemo(
    () => filteredHistory.filter(isGpsHistoryRecord),
    [filteredHistory]
  );

  useEffect(() => {
    setPlaybackIndex((current) => Math.min(current, Math.max(0, gpsFilteredHistory.length - 1)));
  }, [gpsFilteredHistory.length]);

  useEffect(() => {
    const current = gpsFilteredHistory[playbackIndex];

    if (!isPlaying || gpsFilteredHistory.length < 2) {
      setAnimatedPosition(
        current ? [current.latitude, current.longitude] : null
      );
      return;
    }

    const next = gpsFilteredHistory[playbackIndex + 1];

    if (!current || !next) {
      setIsPlaying(false);
      return;
    }

    let frame = 0;
    let startTime: number | null = null;

    const fromLat = current.latitude;
    const fromLng = current.longitude;
    const latDistance = next.latitude - fromLat;
    const lngDistance = next.longitude - fromLng;

    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(latDistance);
    const dLng = toRadians(lngDistance);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(next.latitude)) *
      Math.sin(dLng / 2) ** 2;
    const distanceMeters =
      2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const duration = Math.min(3000, Math.max(900, distanceMeters / 6 * 1000));

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = progress * progress * (3 - 2 * progress);

      setAnimatedPosition([
        fromLat + latDistance * eased,
        fromLng + lngDistance * eased
      ]);

      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      } else {
        setPlaybackIndex(playbackIndex + 1);
      }
    };

    frame = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(frame);
  }, [isPlaying, playbackIndex, gpsFilteredHistory]);

  const playbackPoint = gpsFilteredHistory[playbackIndex] || null;
  const routePositions: [number, number][] = gpsFilteredHistory.map((point) => [point.latitude, point.longitude]);
  const displayedPoint = focusedTimelinePoint || playbackPoint || selectedLiveLocation;

  useEffect(() => {
    let cancelled = false;
    if (!displayedPoint) {
      setLocationName('No GPS location available');
      return () => { cancelled = true; };
    }
    setLocationName('Resolving location...');
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${displayedPoint.latitude}&lon=${displayedPoint.longitude}`;
    fetch(url, { headers: { Accept: 'application/json' } })
      .then((response) => { if (!response.ok) throw new Error('Geocoding failed'); return response.json(); })
      .then((data) => {
        if (!cancelled) setLocationName(safeDisplayText(data?.name) || safeDisplayText(data?.address?.road) || safeDisplayText(data?.address?.suburb) || safeDisplayText(data?.address?.town) || safeDisplayText(data?.address?.city) || safeDisplayText(data?.display_name) || 'Location unavailable');
      })
      .catch(() => { if (!cancelled) setLocationName('Location name unavailable'); });
    return () => { cancelled = true; };
  }, [displayedPoint?.latitude, displayedPoint?.longitude]);

  const selectEmployee = (id: number) => {
    const employee = filteredEmployees.find((item) => item.id === id);
    setIsPlaying(false);
    setPlaybackIndex(0);
    setSelected(employee || null);
  };

  return (
    <div className="live-locations-page">
      <div className="live-locations-heading">
        <div>
          <div className="live-eyebrow"><Activity size={15} /> FIELD OPERATIONS</div>
          <h1>Live Tracking</h1>
          <p>Monitor field and marketing employees and review recorded GPS history.</p>
        </div>
        <button className="live-refresh-button" onClick={() => { void loadEmployees(); void loadLocations(true); }} disabled={refreshing || employeesLoading} type="button">
          <RefreshCw size={17} className={refreshing ? 'live-spin' : ''} />
          {refreshing || employeesLoading ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <div className="live-summary-grid">
        <div className="live-summary-card"><span className="live-summary-icon"><LocateFixed size={19} /></span><div><span>Employees sharing</span><strong>{locations.length}</strong></div></div>
        <div className="live-summary-card"><span className="live-summary-icon"><History size={19} /></span><div><span>GPS history points</span><strong>{gpsFilteredHistory.length}</strong></div></div>
        <div className="live-summary-card"><span className="live-summary-icon"><Clock3 size={19} /></span><div><span>Live refresh</span><strong>30 sec</strong></div></div>
      </div>

      {error && <div className="live-error"><AlertCircle size={18} /> {error}</div>}
      {employeesError && <div className="live-error"><AlertCircle size={18} /> {employeesError}</div>}

      <div className="live-tracking-toolbar">


        <CustomSelect
          label="Employee"
          value={selected ? String(selected.id) : ''}
          options={filteredEmployees.map((item) => ({
            value: String(item.id),
            label: `${employeeName(item)}  ${item.employee_id}`,
          }))}
          onChange={(value) => selectEmployee(Number(value))}
          disabled={employeesLoading || filteredEmployees.length === 0}
          searchable
          loading={employeesLoading}
          emptyLabel="No matching employees"
        />

        <CustomDatePicker
          label="From date"
          value={fromDate}
          max={toDate || undefined}
          onChange={(value) => {
            setFromDate(value);
            setPlaybackIndex(0);
            setIsPlaying(false);
          }}
        />

        <CustomDatePicker
          label="To date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(value) => {
            setToDate(value);
            setPlaybackIndex(0);
            setIsPlaying(false);
          }}
        />

        <button
          type="button"
          className="live-reset-button"
          onClick={() => {
            const today = localDateValue(new Date());
            setFromDate(today);
            setToDate(today);
            setPlaybackIndex(0);
            setIsPlaying(false);
          }}
        >
          Today
        </button>
      </div>

<div className="live-tracking-layout">
        <section className="live-history-panel">
          <div className="live-panel-heading"><div><h2>Location Timeline</h2><p>{selected ? employeeName(selected) : 'Select an employee'}</p><p className="live-timeline-summary">{gpsFilteredHistory.length} GPS points  {filteredHistory.length} total records</p></div><span className="live-history-count">{filteredHistory.length} records</span></div>
          <div className="live-playback-controls">
            <button type="button" className="live-play-button" disabled={gpsFilteredHistory.length < 2} onClick={() => { if (playbackIndex >= gpsFilteredHistory.length - 1) setPlaybackIndex(0); setFocusedTimelinePoint(null); setIsPlaying((value) => !value); }}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />} {isPlaying ? 'Pause' : 'Play route'}
            </button>
            <span>{playbackPoint ? formatTime(playbackPoint.recorded_at, false) : 'No point selected'}</span>
          </div>
          <div className="live-timeline">
  {historyLoading && <div className="live-timeline-message">Loading location history...</div>}

  {!historyLoading && historyError && (
    <div className="live-timeline-message">{historyError}</div>
  )}

  {!historyLoading && !historyError && filteredHistory.length === 0 && (
    <div className="live-timeline-message">No location records for the selected date range.</div>
  )}

  {!historyLoading && !historyError && filteredHistory.slice().reverse().map((point, reverseIndex) => {
    const gpsIndex = gpsFilteredHistory.findIndex(
      (item) => item.id === point.id && item.recorded_at === point.recorded_at
    );
    const isGps = isGpsHistoryRecord(point);
    const kind = String(point.event_type || point.type || (isGps ? 'GPS' : 'EVENT')).toUpperCase();
    const hasCoordinates =
      typeof point.latitude === 'number' &&
      Number.isFinite(point.latitude) &&
      typeof point.longitude === 'number' &&
      Number.isFinite(point.longitude);
    const activeGps = isGps && gpsIndex === playbackIndex && !focusedTimelinePoint;
    const eventTitle = isGps
      ? 'GPS Location'
      : ({
          LOCATION_ON: 'Tracking Started',
          TRACKING_STARTED: 'Tracking Started',
          LOCATION_OFF: 'Tracking Stopped',
          TRACKING_STOPPED: 'Tracking Stopped',
          OUTAGE: 'Outage',
          STOP: 'Stop',
          DRIVE: 'Drive',
          WALK: 'Walk',
          MOVEMENT: 'Movement Detected',
        } as Record<string, string>)[kind] || kind.replace(/_/g, ' ');
    const durationSeconds = point.stop_duration_seconds ?? point.elapsed_seconds;
    const durationText = point.stop_duration_minutes != null
      ? `${point.stop_duration_minutes} min`
      : durationSeconds != null
        ? `${Math.round(durationSeconds / 60)} min`
        : null;
    const description = safeDisplayText(point.details) || safeDisplayText(point.location_name) || (
      isGps ? 'GPS coordinates recorded' : 'Tracking event recorded'
    );

    return (
      <button
        type="button"
        key={`${point.id}-${point.recorded_at}-${kind}-${reverseIndex}`}
        className={`live-timeline-item ${activeGps ? 'active' : ''}`}
        title={hasCoordinates ? 'View this location on the map' : 'No coordinates recorded for this event'}
        onClick={() => {
          setIsPlaying(false);
          if (isGps && gpsIndex >= 0) {
            setFocusedTimelinePoint(null);
            setPlaybackIndex(gpsIndex);
          } else if (hasCoordinates) {
            setFocusedTimelinePoint({
              latitude: point.latitude as number,
              longitude: point.longitude as number,
              recorded_at: point.recorded_at,
              employee_name: point.employee_name,
            });
          } else {
            setFocusedTimelinePoint(null);
          }
        }}
      >
        <span className="live-timeline-marker" />
        <span className="live-timeline-copy">
          <strong>{eventTitle}</strong>
          <small><Clock3 size={12} /> {formatTime(point.recorded_at)}</small>
          <small>{description}</small>
          {durationText && <small>Duration: {durationText}</small>}
          {isGps && (
            <small>
              <MapPin size={12} /> {hasCoordinates
                ? `${point.latitude}, ${point.longitude}`
                : 'Coordinates unavailable'}
            </small>
          )}
          {!isGps && !hasCoordinates && <small>Map location unavailable for this event</small>}
          {isGps && (
            <small>
              {point.accuracy_meters == null
                ? 'Accuracy not recorded'
                : `GPS accuracy ${Math.round(point.accuracy_meters)} m`}
            </small>
          )}
        </span>
      </button>
    );
  })}
</div>
        </section>

        <section className="live-map-panel live-route-panel">
          <div className="live-panel-heading live-map-heading">
  <div className="live-map-heading-main">
    <h2>Route Map</h2>
    <p>{selected ? employeeName(selected) : 'Select an employee'}</p>
    <div className="live-map-meta">
      <span><Clock3 size={13} />{selectedLiveLocation ? `Updated ${formatTime(selectedLiveLocation.recorded_at, false)}` : 'No live update'}</span>
      <span><Activity size={13} />GPS accuracy: {selectedLiveLocation?.accuracy_meters == null ? '' : `${Math.round(selectedLiveLocation.accuracy_meters)} m`}</span>
    </div>
  </div>
  <span className={`live-status-dot ${selectedLiveLocation ? 'is-sharing' : 'is-offline'}`}>
    <span />{selectedLiveLocation ? 'Sharing location' : 'No live GPS'}
  </span>
</div>
          <div className="live-map-wrap live-route-map-wrap">
            <MapContainer center={displayedPoint ? [displayedPoint.latitude, displayedPoint.longitude] : [11.0168, 76.9558]} zoom={displayedPoint ? 14 : 6} scrollWheelZoom className="live-leaflet-map">
              <TileLayer attribution='Imagery &copy; <a href="https://www.esri.com/">Esri</a> and its imagery providers' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
              <TileLayer attribution='Labels &copy; Esri' url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" maxZoom={19} pane="overlayPane" />
              {routePositions.length > 1 && <Polyline positions={routePositions} pathOptions={{ color: '#0056B3', weight: 4, opacity: 0.9 }} />}              {routePositions.length > 0 && gpsFilteredHistory[0] && <CircleMarker center={routePositions[0]} radius={10} pathOptions={{ color: '#FFFFFF', weight: 3, fillColor: '#0056B3', fillOpacity: 1 }}><Popup><strong>START</strong><br />{formatTime(gpsFilteredHistory[0].recorded_at)}</Popup></CircleMarker>}
              {routePositions.length > 1 && gpsFilteredHistory[gpsFilteredHistory.length - 1] && <CircleMarker center={routePositions[routePositions.length - 1]} radius={10} pathOptions={{ color: '#FFFFFF', weight: 3, fillColor: '#DC2626', fillOpacity: 1 }}><Popup><strong>END</strong><br />{formatTime(gpsFilteredHistory[gpsFilteredHistory.length - 1].recorded_at)}</Popup></CircleMarker>}
              {playbackPoint && !focusedTimelinePoint && <Marker position={animatedPosition || [playbackPoint.latitude, playbackPoint.longitude]} icon={L.divIcon({ className: "live-bike-leaflet-icon", html: '<div style="width:32px;height:32px;background:transparent;border:none;border-radius:0;display:flex;align-items:center;justify-content:center;box-shadow:none;"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 64 64" fill="#111827"><circle cx="14" cy="46" r="9"/><circle cx="14" cy="46" r="4" fill="#fff"/><circle cx="49" cy="46" r="9"/><circle cx="49" cy="46" r="4" fill="#fff"/><path d="M12 39h10l8-13h12l8 13h5l4 7h-5l-5-5H34l-7 5H12zM29 26l-5-8h9l5 8zM41 25h8l5 5h-7l-6-5zM31 32h13l5 7H27z"/></svg></div>', iconSize: [32, 32], iconAnchor: [16, 16] })}><Popup><strong>{selected ? employeeName(selected) : playbackPoint.employee_name}</strong><br />Recorded: {formatTime(playbackPoint.recorded_at)}<br />Location: {locationName}</Popup></Marker>}

              <MapFocus point={displayedPoint} />              <MapControls point={displayedPoint} routePositions={routePositions} />
            </MapContainer>
            {loading && <div className="live-map-overlay">Loading locations...</div>}
            <div className="live-map-marker-legend">
              <span><i className="legend-start" />Start</span>
              <span><i className="legend-end" />End</span>
              <span><i className="legend-current" />Selected point</span>
            </div>            {!loading && !displayedPoint && <div className="live-map-empty"><MapPin size={27} /><strong>No GPS location available</strong><span>{selected ? 'This employee has no live GPS update or recorded GPS points for the selected date range.' : 'Select an employee to review their GPS history.'}</span></div>}
          </div>
          <div className="live-route-footer"><div><Route size={16} /><span>{gpsFilteredHistory.length > 1 ? `${gpsFilteredHistory.length} recorded GPS points connected` : `${gpsFilteredHistory.length} recorded GPS point`}</span></div><div className="live-range-control"><span>{gpsFilteredHistory.length ? `${playbackIndex + 1} / ${gpsFilteredHistory.length}` : '0 / 0'}</span><input aria-label="Route playback position" type="range" min={0} max={Math.max(0, gpsFilteredHistory.length - 1)} value={Math.min(playbackIndex, Math.max(0, gpsFilteredHistory.length - 1))} disabled={filteredHistory.length === 0} onChange={(event) => { setPlaybackIndex(Number(event.target.value)); setIsPlaying(false); }} /></div></div>
        </section>
      </div>

      <section className="live-employee-panel live-sharing-panel">
        <div className="live-panel-heading"><div><h2>Currently Sharing</h2><p>Latest GPS update from each employee</p></div><span className="live-history-count">{locations.length} employees</span></div>
        <div className="live-sharing-grid">
          {locations.map((item) => <button type="button" key={`${item.id}-${item.employee_id}`} className={`live-sharing-card ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => {
            const profile = employees.find((employee) => employee.id === item.id || employee.employee_id === item.employee_id);
            if (profile) setSelected(profile);
          }}>
            <span className="live-avatar">{(item.employee_name || 'E').trim().charAt(0).toUpperCase()}</span>
            <span className="live-employee-info"><strong>{item.employee_name}</strong><span>{item.employee_id} - {item.branch || 'Branch not assigned'}</span><small>{item.designation || item.department || 'Employee'}</small><small>Updated {formatTime(item.recorded_at)}</small></span><span className="live-row-dot" />
          </button>)}
          {!loading && locations.length === 0 && <div className="live-list-empty">No employees are currently sharing a location.</div>}
        </div>
      </section>

      {selected && <div className="live-selected-details live-selected-summary">
        <h3>Selected Employee Details</h3>
        <p><span>Name</span><strong>{employeeName(selected)}</strong></p>
        <p><span>Employee ID</span><strong>{selected.employee_id}</strong></p>
        <p><span>Department</span><strong>{selected.department || '-'}</strong></p>
        <p><span>Designation</span><strong>{selected.designation || '-'}</strong></p>
        <p><span>Work type</span><strong>{selected.work_type || '-'}</strong></p>
        <p><span>Branch</span><strong>{getEmployeeBranch(selected) !== '-' ? getEmployeeBranch(selected) : (selectedLiveLocation?.branch || '-')}</strong></p>
        <p><span>GPS accuracy</span><strong>{selectedLiveLocation?.accuracy_meters == null ? 'Not provided' : `${Math.round(selectedLiveLocation.accuracy_meters)} m`}</strong></p>
        <p><span>Last update</span><strong>{selectedLiveLocation ? formatTime(selectedLiveLocation.recorded_at) : 'No live GPS update'}</strong></p>
        <p className="live-location-name"><span>Location</span><strong>{locationName}</strong></p>
      </div>}

      <p className="live-footer-note">Live positions refresh every 30 seconds. Employee dropdown uses the employee master list. History shows up to the latest 200 GPS records returned by the API; date filtering applies to those records. The route connects recorded points and does not imply road-level travel or unrecorded stops.</p>
    </div>
  );
};

export default LiveLocations;
































