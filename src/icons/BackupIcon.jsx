import React from 'react';

export default function BackupIcon({ size = 16, className, style }) {
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
      {/* Shield */}
      <path d="M12 3l7 3v6c0 4.418-3.134 8-7 8s-7-3.582-7-8V6l7-3z" fill="#2D8CFF" stroke="#ffffff" strokeWidth="1.2" />
      <path d="M10 12l1.7 1.7L14.5 11" stroke="#9EF28B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
