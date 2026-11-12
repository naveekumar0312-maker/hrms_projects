import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import "./custom-dropdown.css";

export interface Option {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  alignRight?: boolean;
  direction?: 'down' | 'up' | 'auto';
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  icon,
  searchPlaceholder = "Search...",
  disabled = false,
  className,
  alignRight = false,
  direction = 'auto',
}: CustomSelectProps) {
  const [openUpward, setOpenUpward] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className={`custom-select-container ${className || ""}`}
      ref={dropdownRef}
    >
      <button
        type="button"
        disabled={disabled}
        className={`custom-select-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          if (!disabled) {
            if (!isOpen) {
              if (direction === 'up') {
                setOpenUpward(true);
              } else if (direction === 'down') {
                setOpenUpward(false);
              } else if (dropdownRef.current) {
                const rect = dropdownRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                setOpenUpward(spaceBelow < 260 && rect.top > 260);
              }
            }
            setIsOpen((prev) => !prev);
            setSearchTerm("");
          }
        }}
        aria-expanded={isOpen}
      >
        {icon && <div className="custom-select-trigger-icon">{icon}</div>}
        <span className="custom-select-trigger-text">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={15} className="custom-select-trigger-arrow" />
      </button>

      {isOpen && !disabled && (
        <div
          className={`custom-select-dropdown ${
            alignRight ? "align-right" : ""
          } ${openUpward ? "open-upward" : ""}`}
        >
          {options.length > 5 && (
              <div className="custom-select-search-wrapper">
                <Search size={15} className="custom-select-search-icon" />
                <input
                  type="text"
                  className="custom-select-search-input"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            )}

            <div className="custom-select-options">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      className={`custom-select-option ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                      title={opt.label}
                    >
                      <span className="custom-select-option-text">
                        {opt.label}
                      </span>
                      {isSelected && (
                        <span className="custom-select-option-check">
                          <Check size={14} />
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="custom-select-no-options">No options found</div>
              )}
            </div>
          </div>
        )
      }
    </div>
  );
}

export default CustomSelect;
