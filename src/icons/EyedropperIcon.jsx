import React from 'react';

export default function EyedropperIcon({ size = 16, className, style }) {
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
      <path d="M15.4 4.6l4 4-2.4 2.4 1.3 1.3a1 1 0 010 1.4l-1.6 1.6a1 1 0 01-1.4 0l-1.3-1.3-6.6 6.6H6v-4l6.6-6.6-1.3-1.3a1 1 0 010-1.4l1.6-1.6a1 1 0 011.4 0l1.3 1.3 2.4-2.4z" fill="#FF7EB6" stroke="#ffffff" strokeWidth="1.2" />
      <path d="M6 18h3.2" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
