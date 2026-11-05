import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, X, ChevronDown, User } from 'lucide-react';
import './EmployeeMultiSelect.css';

export interface AssignableMember {
  id: number;
  full_name: string;
  employee_id?: string;
  designation?: string;
  department?: string;
  role?: string;
  profile_photo_url?: string | null;
}

interface EmployeeMultiSelectProps {
  members: AssignableMember[];
  selectedIds: number[];
  onChange: (newIds: number[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const EmployeeMultiSelect: React.FC<EmployeeMultiSelectProps> = ({
  members,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = 'Select employees...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedMembers = members.filter((m) => selectedIds.includes(m.id));

  const filteredMembers = members.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(term) ||
      m.employee_id?.toLowerCase().includes(term) ||
      m.designation?.toLowerCase().includes(term) ||
      m.department?.toLowerCase().includes(term)
    );
  });

  const toggleMember = (id: number) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeMember = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedIds.filter((item) => item !== id));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange([]);
  };

  // Helper for rendering avatar image or fallback initials
  const renderAvatar = (m: AssignableMember, size = 28) => {
    if (m.profile_photo_url) {
      return (
        <img
          src={m.profile_photo_url}
          alt={m.full_name}
          className="emp-avatar-img"
          style={{ width: `${size}px`, height: `${size}px` }}
          onError={(e) => {
            // fallback to initials on error
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    const initials = m.full_name
      ? m.full_name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : 'U';
    return (
      <div
        className="emp-avatar-initials"
        style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(10, size * 0.4)}px` }}
      >
        {initials}
      </div>
    );
  };

  return (
    <div className={`emp-multiselect-container ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      {/* TRIGGER BAR */}
      <div
        className={`emp-multiselect-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="emp-multiselect-content">
          {selectedMembers.length === 0 ? (
            <span className="emp-multiselect-placeholder">{placeholder}</span>
          ) : (
            <div className="emp-multiselect-summary">
              {/* Overlapping circular avatars (up to 4) */}
              <div className="emp-avatar-stack">
                {selectedMembers.slice(0, 4).map((m) => (
                  <div key={m.id} className="emp-stacked-avatar" title={m.full_name}>
                    {renderAvatar(m, 26)}
                  </div>
                ))}
                {selectedMembers.length > 4 && (
                  <div className="emp-stacked-more">
                    +{selectedMembers.length - 4}
                  </div>
                )}
              </div>

              <span className="emp-selected-count">
                {selectedMembers.length} {selectedMembers.length === 1 ? 'employee' : 'employees'} selected
              </span>
            </div>
          )}
        </div>

        <div className="emp-multiselect-actions">
          {selectedMembers.length > 0 && !disabled && (
            <button
              type="button"
              className="emp-clear-btn"
              onClick={clearAll}
              title="Clear all selections"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className={`emp-chevron ${isOpen ? 'rotated' : ''}`} />
        </div>
      </div>

      {/* SELECTED PILLS ROW (Visible below trigger for easy removal) */}
      {selectedMembers.length > 0 && (
        <div className="emp-selected-pills-row">
          {selectedMembers.map((m) => (
            <span key={m.id} className="emp-selected-pill">
              {renderAvatar(m, 20)}
              <span className="emp-pill-name">{m.full_name}</span>
              {!disabled && (
                <button
                  type="button"
                  className="emp-pill-remove"
                  onClick={(e) => removeMember(m.id, e)}
                  title="Remove"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* DROPDOWN POPUP */}
      {isOpen && (
        <div className="emp-multiselect-dropdown">
          {/* SEARCH BOX */}
          <div className="emp-search-header">
            <Search size={15} className="emp-search-icon" />
            <input
              type="text"
              className="emp-search-input"
              placeholder="Search by name, ID, or designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* LIST */}
          <div className="emp-list-scroll">
            {filteredMembers.length === 0 ? (
              <div className="emp-no-results">
                <User size={24} color="#94a3b8" />
                <span>No matching employees found</span>
              </div>
            ) : (
              filteredMembers.map((m) => {
                const isSelected = selectedIds.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className={`emp-list-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleMember(m.id)}
                  >
                    <div className="emp-item-avatar-wrapper">
                      {renderAvatar(m, 34)}
                    </div>
                    <div className="emp-item-info">
                      <div className="emp-item-name">{m.full_name}</div>
                      <div className="emp-item-meta">
                        {m.employee_id && <span className="emp-meta-id">{m.employee_id}</span>}
                        {m.designation && <span className="emp-meta-desig">&bull; {m.designation}</span>}
                      </div>
                    </div>
                    <div className="emp-item-check">
                      <div className={`emp-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

