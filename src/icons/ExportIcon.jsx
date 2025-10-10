import React from 'react';

export default function ExportIcon({ size = 16, className, style }) {
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
      {/* Tray */}
      <rect x="4" y="15" width="16" height="5" rx="1.6" stroke="#ffffff" strokeWidth="1.6" />
      {/* Arrow up */}
      <path d="M12 13V4" stroke="#4AA8FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 7.5L12 4l3.5 3.5" stroke="#4AA8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
