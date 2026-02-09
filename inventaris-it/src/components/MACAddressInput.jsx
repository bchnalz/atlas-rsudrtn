import { useRef, useState, useEffect } from 'react';

/**
 * MAC Address Input Component
 * Format: XX:XX:XX:XX:XX:XX (hexadecimal, separator :)
 * Features: Auto-jump, hex validation, copy-paste support
 */
export default function MACAddressInput({ value, onChange, placeholder = '00:00:00:00:00:00' }) {
  const [segments, setSegments] = useState(['', '', '', '', '', '']);
  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  // Parse value prop to segments
  useEffect(() => {
    if (value) {
      // Support both : and - separators
      const parts = value.split(/[:-]/);
      setSegments([
        parts[0] || '',
        parts[1] || '',
        parts[2] || '',
        parts[3] || '',
        parts[4] || '',
        parts[5] || '',
      ]);
    } else {
      setSegments(['', '', '', '', '', '']);
    }
  }, [value]);

  // Update parent component
  const updateValue = (newSegments) => {
    const fullValue = newSegments.join(':');
    // Only send non-empty values
    if (newSegments.every(s => s === '')) {
      onChange('');
    } else {
      onChange(fullValue);
    }
  };

  const handleChange = (index, newValue) => {
    // Convert to uppercase and only allow hex characters
    const upperValue = newValue.toUpperCase();
    if (upperValue && !/^[0-9A-F]+$/.test(upperValue)) return;

    // Max 2 characters per segment
    if (upperValue.length > 2) return;

    const newSegments = [...segments];
    newSegments[index] = upperValue;
    setSegments(newSegments);
    updateValue(newSegments);

    // Auto-jump to next input when segment is complete (2 chars)
    if (upperValue.length === 2 && index < 5) {
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

    // Colon/Dash: jump to next input
    if ((e.key === ':' || e.key === '-') && index < 5) {
      e.preventDefault();
      inputRefs[index + 1].current?.focus();
      inputRefs[index + 1].current?.select();
    }

    // Arrow Right: move to next segment at end
    if (e.key === 'ArrowRight' && input.selectionStart === value.length && index < 5) {
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
    const pastedText = e.clipboardData.getData('text').toUpperCase();
    
    // Try to parse as MAC address (support both : and - separators)
    const macMatch = pastedText.match(/^([0-9A-F]{2})[:-]([0-9A-F]{2})[:-]([0-9A-F]{2})[:-]([0-9A-F]{2})[:-]([0-9A-F]{2})[:-]([0-9A-F]{2})$/);
    if (macMatch) {
      const newSegments = [
        macMatch[1],
        macMatch[2],
        macMatch[3],
        macMatch[4],
        macMatch[5],
        macMatch[6],
      ];
      setSegments(newSegments);
      updateValue(newSegments);
    }
  };

  const handleClear = () => {
    setSegments(['', '', '', '', '', '']);
    updateValue(['', '', '', '', '', '']);
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
              value={segment}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className="w-6 text-center bg-transparent border-none outline-none text-xs font-mono uppercase text-white placeholder-gray-600"
              placeholder={placeholder.split(':')[index]}
              maxLength={2}
            />
            {index < 5 && <span className="text-gray-600 font-mono text-xs">:</span>}
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
