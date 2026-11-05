import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { CustomSelect } from '../../components/CustomSelect';

interface Holiday {
  id: number;
  name: string;
  date: string;
  description?: string | null;
}

const now = new Date();

export default function EmployeeHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/holidays/', { params: { month, year } });
      const data = response.data;
      setHolidays(Array.isArray(data) ? data : data?.results ?? []);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        'Unable to load holidays. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadHolidays();
  }, [loadHolidays]);

  const fieldStyle: React.CSSProperties = {
    padding: '10px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: 8,
    background: '#FFFFFF',
    fontSize: 14,
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24,
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#111827', fontSize: 26 }}>Holidays</h1>
          <p style={{ color: '#6B7280', margin: '8px 0 0', fontSize: 14 }}>
            View your company's holiday calendar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadHolidays()}
          style={{
            ...fieldStyle, cursor: 'pointer', fontWeight: 600,
          }}
        >
          <RefreshCw size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', padding: 12, borderRadius: 8 }}>
          {error}
        </p>
      )}

      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap',
        padding: 16, border: '1px solid #E5E7EB', borderRadius: 12,
        marginBottom: 20, background: '#FFFFFF', alignItems: 'center',
      }}>
        <div style={{ display: 'grid', gap: 6, fontSize: 13, color: '#4B5563', width: 200 }}>
          <span>Month</span>
          <CustomSelect
            value={month}
            onChange={setMonth}
            options={[
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December',
            ].map((name, index) => ({
              value: String(index + 1),
              label: name,
            }))}
            placeholder="Select Month"
          />
        </div>
        <div style={{ display: 'grid', gap: 6, fontSize: 13, color: '#4B5563', width: 160 }}>
          <span>Year</span>
          <CustomSelect
            value={year}
            onChange={setYear}
            options={Array.from({ length: 7 }, (_, index) => now.getFullYear() - 2 + index).map((val) => ({
              value: String(val),
              label: String(val),
            }))}
            placeholder="Select Year"
          />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 14,
      }}>
        {loading ? (
          <p>Loading holidays...</p>
        ) : holidays.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1', padding: 36, textAlign: 'center',
            border: '1px solid #E5E7EB', borderRadius: 12, background: '#FFFFFF',
            color: '#6B7280',
          }}>
            <CalendarDays size={30} style={{ marginBottom: 10 }} />
            <p style={{ margin: 0 }}>No holidays listed for this month.</p>
          </div>
        ) : holidays.map((holiday) => (
          <article key={holiday.id} style={{
            padding: 20, background: '#FFFFFF',
            border: '1px solid #E5E7EB', borderRadius: 12,
            borderLeft: '4px solid #E56108',
          }}>
            <p style={{
              margin: '0 0 8px', fontSize: 12,
              color: '#C2410C', fontWeight: 700, textTransform: 'uppercase',
            }}>
              {new Date(`${holiday.date}T00:00:00`).toLocaleDateString('en-IN', {
                weekday: 'long',
              })}
            </p>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#111827' }}>
              {holiday.name}
            </h2>
            <p style={{ margin: '0 0 10px', color: '#4B5563', fontSize: 14 }}>
              {new Date(`${holiday.date}T00:00:00`).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
            {holiday.description && (
              <p style={{ margin: 0, color: '#6B7280', fontSize: 13, lineHeight: 1.5 }}>
                {holiday.description}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
