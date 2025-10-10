import React from 'react';

export default function LoadIcon({ size = 16, className, style }) {
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
      <rect x="4" y="4" width="16" height="16" rx="2.2" fill="#1F9D5B" stroke="#fff" strokeWidth="1.2" />
      <path d="M8 12h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 16h6" stroke="#D9FFE8" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 8h10" stroke="#BFF5DA" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
