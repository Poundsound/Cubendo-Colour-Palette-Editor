export default function SwatchModeIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'inline-block' }}
    >
      <rect x="4" y="4" width="6" height="6" rx="1.2" fill="#6AA8FF" stroke="#A9C7FF" strokeWidth="1" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" fill="#7ED6A8" stroke="#B6F0CF" strokeWidth="1" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" fill="#F2C94C" stroke="#FFE08A" strokeWidth="1" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" fill="#EB5757" stroke="#FF9A9A" strokeWidth="1" />
    </svg>
  );
}
