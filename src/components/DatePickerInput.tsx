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

  // Detect mobile by window width
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 800);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      // Format as YYYY-MM-DD
      const iso = date.toISOString().split('T')[0];
      onChange(iso);
      setIsOpen(false);
    }
  };

  // Accept manual typing always
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Accept native date input or manual text
    if (/^\d{4}-\d{2}-\d{2}$/.test(inputValue)) {
      onChange(inputValue);
    } else if (inputValue === '') {
      onChange('');
    } else {
      // For native date input, let browser handle
      onChange(inputValue);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <input
        ref={inputRef}
        type={isMobile ? 'date' : 'text'}
        className={`field ${className}`}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        onFocus={() => !isMobile && setIsOpen(true)}
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
