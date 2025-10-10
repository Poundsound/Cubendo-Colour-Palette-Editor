import React from 'react';

export default function PresetsIcon({ size = 16, className, style }) {
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
      {/* Palette */}
      <path d="M12 3a9 9 0 100 18c1.5 0 2.2-.9 2.7-1.7.4-.6.6-1 .9-1 .7 0 1.6.1 2.3-.6.8-.7.9-1.8.6-2.5-.4-.9-1.4-1.2-2.1-1.2H13a2 2 0 01-2-2V7.6c0-.8-.3-1.8-1.2-2.1C9 5.2 7.9 5.3 7.2 6.1 6.5 6.8 6.6 7.7 6.6 8.4 6.6 9 6.2 9.2 5.6 9.6 4.8 10 4 10.5 4 12a8 8 0 018-9z" fill="#FFC066" stroke="#fff" strokeWidth="1.1" />
      {/* Dots */}
      <circle cx="8.5" cy="10" r="1.4" fill="#FF7EB6" />
      <circle cx="10.8" cy="7.8" r="1.2" fill="#7DD3FC" />
      <circle cx="14.2" cy="8.6" r="1.3" fill="#86EFAC" />
    </svg>
  );
}
