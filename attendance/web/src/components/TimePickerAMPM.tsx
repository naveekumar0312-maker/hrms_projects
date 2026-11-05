import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { formatTimeAMPM } from '../utils/timeUtils';

interface TimePickerAMPMProps {
  value: string; // HH:MM 24-hour format
  onChange: (value: string) => void;
  required?: boolean;
}

export const TimePickerAMPM: React.FC<TimePickerAMPMProps> = ({ value, onChange, required }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse internal 24h to 12h for the selectors
  let initHour12 = '12';
  let initMin = '00';
  let initAmPm = 'AM';

  if (value) {
    const [hStr, mStr] = value.split(':');
    let h = parseInt(hStr, 10);
    initAmPm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    initHour12 = h.toString().padStart(2, '0');
    initMin = mStr;
  }

  const [hour, setHour] = useState(initHour12);
  const [minute, setMinute] = useState(initMin);
  const [ampm, setAmpm] = useState(initAmPm);

  useEffect(() => {
    if (value) {
      const [hStr, mStr] = value.split(':');
      let h = parseInt(hStr, 10);
      const a = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      setHour(h.toString().padStart(2, '0'));
      setMinute(mStr);
      setAmpm(a);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApply = () => {
    // Convert 12h back to 24h
    let h = parseInt(hour, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    
    const formatted24h = `${h.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
    onChange(formatted24h);
    setIsOpen(false);
  };

  const displayValue = value ? formatTimeAMPM(value) : '';

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      <div 
        className="form-control" 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: 'var(--card-bg)' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ color: displayValue ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {displayValue || 'Select time...'}
        </span>
        <Clock size={16} color="var(--text-muted)" />
      </div>
      
      {/* Hidden input for HTML validation if required */}
      {required && <input type="text" style={{ opacity: 0, position: 'absolute', height: 0, width: 0, padding: 0, border: 'none' }} value={value} required readOnly />}

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '0.5rem',
          backgroundColor: 'white',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          zIndex: 1050,
          padding: '1rem',
          minWidth: '240px'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Select Time
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Hour</div>
              <select className="form-control" value={hour} onChange={e => setHour(e.target.value)} style={{ padding: '0.375rem 0.5rem' }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => {
                  const val = h.toString().padStart(2, '0');
                  return <option key={val} value={val}>{val}</option>;
                })}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Minute</div>
              <select className="form-control" value={minute} onChange={e => setMinute(e.target.value)} style={{ padding: '0.375rem 0.5rem' }}>
                {Array.from({ length: 60 }, (_, i) => i).map(m => {
                  const val = m.toString().padStart(2, '0');
                  return <option key={val} value={val}>{val}</option>;
                })}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>AM/PM</div>
              <select className="form-control" value={ampm} onChange={e => setAmpm(e.target.value)} style={{ padding: '0.375rem 0.5rem' }}>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }} onClick={() => setIsOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }} onClick={handleApply}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
};

