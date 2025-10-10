export default function RowModeIcon({ size = 16 }) {
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
      <rect x="3" y="5" width="18" height="3" rx="1.5" fill="#6AA8FF" />
      <rect x="3" y="10.5" width="18" height="3" rx="1.5" fill="#7ED6A8" />
      <rect x="3" y="16" width="18" height="3" rx="1.5" fill="#F2C94C" />
    </svg>
  );
}
