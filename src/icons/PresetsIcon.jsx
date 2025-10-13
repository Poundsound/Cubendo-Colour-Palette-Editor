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
      {/* Painter's palette */}
      <path d="M12 3c-5 0-9 3.6-9 8 0 2 1 3 2.5 3 .9 0 1.2-.3 2-.3.8 0 1.5.9 1.5 1.9 0 1.5-1.2 2.4-1.2 3.4 0 1.6 1.7 2 3.2 2 5 0 9-3.6 9-8s-4-10-8-10z" fill="#1f1f1f" stroke="#fff" strokeWidth="1.3" />
      {/* paint blobs */}
      <circle cx="8" cy="9.2" r="1.2" fill="#ff6b6b" />
      <circle cx="10.8" cy="7.6" r="1.1" fill="#ffd166" />
      <circle cx="14" cy="8.4" r="1.15" fill="#06d6a0" />
      <circle cx="15.4" cy="11" r="1.05" fill="#4dabf7" />
      {/* thumb hole */}
      <circle cx="6.8" cy="12.8" r="1.4" fill="#0f0f0f" stroke="#333" strokeWidth="0.8" />
    </svg>
  );
}
