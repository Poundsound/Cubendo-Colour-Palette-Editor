export default function RedoIcon({ size = 16 }) {
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
      <defs>
        <linearGradient id="redoGrad" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6AA8FF" />
          <stop offset="100%" stopColor="#A9C7FF" />
        </linearGradient>
      </defs>
      <path d="M16 10H8.5C5.74 10 3.5 12.24 3.5 15C3.5 17.76 5.74 20 8.5 20" stroke="url(#redoGrad)" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M14 13L17 10L14 7" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
