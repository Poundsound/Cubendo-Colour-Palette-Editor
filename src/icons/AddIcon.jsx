import React from 'react';

export default function AddIcon({ size = 16, className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <circle cx="12" cy="12" r="9" fill="#5BC77A" stroke="#ffffff" strokeWidth="1.2" />
      <path d="M12 8v8M8 12h8" stroke="#0C2A15" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
