import { useRef, useState, useEffect } from 'react';

/**
 * IP Address Input Component
 * Format: XXX.XXX.XXX.XXX (0-255 per segment)
 * Features: Auto-jump, validation, copy-paste support
 */
export default function IPAddressInput({ value, onChange, placeholder = '...' }) {
  const [segments, setSegments] = useState(['', '', '', '']);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Parse value prop to segments
  useEffect(() => {
    if (value) {
      const parts = value.split('.');
      setSegments([
        parts[0] || '',
        parts[1] || '',
        parts[2] || '',
        parts[3] || '',
      ]);
    } else {
      setSegments(['', '', '', '']);
    }
  }, [value]);

  // Update parent component
  const updateValue = (newSegments) => {
    const fullValue = newSegments.join('.');
    // Only send non-empty values
    if (newSegments.every(s => s === '')) {
      onChange('');
    } else {
      onChange(fullValue);
    }
  };

  const handleChange = (index, newValue) => {
    // Only allow numbers
    if (newValue && !/^\d+$/.test(newValue)) return;

    // Validate range (0-255)
    const numValue = parseInt(newValue, 10);
    if (newValue && (numValue > 255 || numValue < 0)) return;

    const newSegments = [...segments];
    newSegments[index] = newValue;
    setSegments(newSegments);
    updateValue(newSegments);

    // Auto-jump to next input when segment is complete
    if (newValue.length === 3 && index < 3) {
      inputRefs[index + 1].current?.focus();
      inputRefs[index + 1].current?.select();
    }
  };

  const handleKeyDown = (index, e) => {
    const input = e.target;
    const value = input.value;

    // Backspace: jump to previous input if empty
    if (e.key === 'Backspace' && value === '' && index > 0) {
      e.preventDefault();
      inputRefs[index - 1].current?.focus();
      const prevValue = segments[index - 1];
      inputRefs[index - 1].current?.setSelectionRange(prevValue.length, prevValue.length);
    }

    // Dot/Period: jump to next input
    if (e.key === '.' && index < 3) {
      e.preventDefault();
      inputRefs[index + 1].current?.focus();
      inputRefs[index + 1].current?.select();
    }

    // Arrow Right: move to next segment at end
    if (e.key === 'ArrowRight' && input.selectionStart === value.length && index < 3) {
      e.preventDefault();
      inputRefs[index + 1].current?.focus();
      inputRefs[index + 1].current?.setSelectionRange(0, 0);
    }

    // Arrow Left: move to previous segment at start
    if (e.key === 'ArrowLeft' && input.selectionStart === 0 && index > 0) {
      e.preventDefault();
      const prevValue = segments[index - 1];
      inputRefs[index - 1].current?.focus();
      inputRefs[index - 1].current?.setSelectionRange(prevValue.length, prevValue.length);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    // Try to parse as IP address
    const ipMatch = pastedText.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const newSegments = [
        ipMatch[1],
        ipMatch[2],
        ipMatch[3],
        ipMatch[4],
      ].map(s => {
        const num = parseInt(s, 10);
        return num <= 255 ? s : '';
      });
      setSegments(newSegments);
      updateValue(newSegments);
    }
  };

  const handleClear = () => {
    setSegments(['', '', '', '']);
    updateValue(['', '', '', '']);
    inputRefs[0].current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-0.5 bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-gray-600 focus-within:border-transparent">
        {segments.map((segment, index) => (
          <div key={index} className="flex items-center">
            <input
              ref={inputRefs[index]}
              type="text"
              inputMode="numeric"
              value={segment}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className="w-9 text-center bg-transparent border-none outline-none text-xs font-mono text-white placeholder-gray-600"
              placeholder={placeholder.split('.')[index]}
              maxLength={3}
            />
            {index < 3 && <span className="text-gray-600 font-mono text-xs">.</span>}
          </div>
        ))}
        
        {segments.some(s => s !== '') && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 text-gray-500 hover:text-white transition"
            title="Clear"
          >
            <span className="text-xs">×</span>
          </button>
        )}
      </div>
    </div>
  );
}
