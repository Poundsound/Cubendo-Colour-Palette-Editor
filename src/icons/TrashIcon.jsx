import React from 'react';

export default function TrashIcon({ size = 16, className, style }) {
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
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2z" fill="#FF5252" />
      <rect x="6" y="7" width="12" height="13" rx="1.8" fill="#1F1F1F" stroke="#FF5252" strokeWidth="1.2" />
      <path d="M10 10v7M14 10v7" stroke="#FF9E9E" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
