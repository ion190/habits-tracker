import React, { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import '../styles/datepicker.css';

interface DatePickerInputProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function DatePickerInput({
  value,
  onChange,
  placeholder = 'Pick a date',
  className = '',
}: DatePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // Detect mobile by window width
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 800);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const normalizeDateValue = (rawValue: string): string | undefined => {
    const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const date = new Date(`${rawValue}T00:00:00`);
      if (!Number.isNaN(date.getTime())) return rawValue;
    }

    const usMatch = rawValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
      if (!Number.isNaN(date.getTime())) return date.toISOString().split('T')[0];
    }

    const isoAltMatch = rawValue.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (isoAltMatch) {
      const [, year, month, day] = isoAltMatch;
      const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
      if (!Number.isNaN(date.getTime())) return date.toISOString().split('T')[0];
    }

    return undefined;
  };

  // Parse the value to a Date object
  const selectedDate = value ? new Date(value + 'T00:00:00') : undefined;

  // Calculate dropdown position (desktop only)
  useEffect(() => {
    if (isOpen && inputRef.current && !isMobile) {
      const rect = inputRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [isOpen, isMobile]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const iso = date.toISOString().split('T')[0];
      setInputValue(iso);
      onChange(iso);
      setIsOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setInputValue(rawValue);

    if (rawValue === '') {
      onChange('');
      return;
    }

    const normalized = normalizeDateValue(rawValue);
    if (normalized) {
      onChange(normalized);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const normalized = normalizeDateValue(inputValue);
    if (normalized) {
      setInputValue(normalized);
      onChange(normalized);
      setIsOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%', zIndex: isOpen ? 10001 : undefined }}>
      <input
        ref={inputRef}
        type={isMobile ? 'date' : 'text'}
        className={`field ${className}`}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        onFocus={() => !isMobile && setIsOpen(true)}
        inputMode="numeric"
        pattern="\d{4}-\d{2}-\d{2}"
        style={isMobile ? { fontSize: 16 } : {}}
      />

      {/* Desktop calendar popup */}
      {!isMobile && isOpen && (
        <div
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            zIndex: 10000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            defaultMonth={selectedDate || new Date()}
            weekStartsOn={1}
          />
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setIsOpen(false)}
            style={{ width: '100%', marginTop: 8 }}
          >
            Close
          </button>
        </div>
      )}

      {/* Overlay to close popup on desktop */}
      {!isMobile && isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
