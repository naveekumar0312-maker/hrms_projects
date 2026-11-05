import React, { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import './custom-datepicker.css';

export interface CustomDatePickerProps {
  label?: string;
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  alignRight?: boolean;
  disabled?: boolean;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  min,
  max,
  className,
  placeholder = 'Select date',
  alignRight = false,
  disabled = false,
}) => {
  const effectiveMin = minDate || min;
  const effectiveMax = maxDate || max;

  const containerRef = useRef<HTMLDivElement>(null);
  const [openUpwards, setOpenUpwards] = useState(false);

  const parseDate = (input: string) => {
    if (!input) return new Date();
    const parts = input.split('-').map(Number);
    return parts.length === 3 && parts.every(Number.isFinite)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  };

  const toDateString = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDate(value));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from(
    { length: firstWeekday + daysInMonth },
    (_, index) => (index < firstWeekday ? null : index - firstWeekday + 1)
  );

  const isDisabled = (day: number) => {
    const date = toDateString(new Date(year, month, day));
    return Boolean(
      (effectiveMin && date < effectiveMin) || (effectiveMax && date > effectiveMax)
    );
  };

  const todayStr = toDateString(new Date());

  // Auto-detect viewport collision: if near screen bottom, open upwards!
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popupHeight = 330;
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < popupHeight && rect.top > popupHeight) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [open]);

  // Generate Year options (from 1940 to 2040)
  const years = Array.from({ length: 101 }, (_, i) => 1940 + i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div
      ref={containerRef}
      className={`custom-datepicker-container ${className || ''}`}
    >
      {label && (
        <span className="custom-datepicker-label">
          <CalendarDays size={13} />
          {label}
        </span>
      )}

      <button
        type="button"
        disabled={disabled}
        className={`custom-datepicker-trigger ${open ? 'active' : ''}`}
        aria-expanded={open}
        onClick={() => {
          if (!disabled) {
            setViewDate(parseDate(value));
            setOpen((prev) => !prev);
          }
        }}
      >
        <span>
          {value
            ? parseDate(value).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : placeholder}
        </span>
        <CalendarDays size={15} className="custom-datepicker-trigger-icon" />
      </button>

      {open && !disabled && (
        <>
          <div
            role="presentation"
            className="custom-datepicker-dismiss"
            onClick={() => setOpen(false)}
          />
          <div
            className={`custom-datepicker-calendar ${
              alignRight ? 'align-right' : ''
            } ${openUpwards ? 'open-upwards' : ''}`}
          >
            <div className="custom-datepicker-heading">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
              >
                <ChevronLeft size={16} />
              </button>

              <div className="custom-datepicker-selectors">
                <select
                  className="custom-datepicker-month-select"
                  value={month}
                  onChange={(e) => setViewDate(new Date(year, Number(e.target.value), 1))}
                >
                  {months.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  className="custom-datepicker-year-select"
                  value={year}
                  onChange={(e) => setViewDate(new Date(Number(e.target.value), month, 1))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="custom-datepicker-grid">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <span key={d} className="custom-datepicker-weekday">
                  {d}
                </span>
              ))}
              {cells.map((day, idx) => {
                if (day === null) {
                  return (
                    <span
                      key={`empty-${idx}`}
                      className="custom-datepicker-blank"
                    />
                  );
                }

                const date = toDateString(new Date(year, month, day));
                const isSelected = date === value;
                const isToday = date === todayStr;

                return (
                  <button
                    type="button"
                    key={date}
                    disabled={isDisabled(day)}
                    className={`custom-datepicker-day ${
                      isSelected ? 'is-selected' : ''
                    } ${isToday ? 'is-today' : ''}`}
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
              className="custom-datepicker-today-btn"
              onClick={() => {
                if (
                  (!effectiveMin || todayStr >= effectiveMin) &&
                  (!effectiveMax || todayStr <= effectiveMax)
                ) {
                  onChange(todayStr);
                  setViewDate(parseDate(todayStr));
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
  );
};

export default CustomDatePicker;
