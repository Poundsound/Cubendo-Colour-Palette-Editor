import React from 'react';

export default function SaveIcon({ size = 16, className, style }) {
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
      <rect x="4" y="4" width="16" height="16" rx="2.2" fill="#2A74FF" stroke="#fff" strokeWidth="1.2" />
      <path d="M8 9h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 13h8" stroke="#D9E6FF" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 17h6" stroke="#BFD0FF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
