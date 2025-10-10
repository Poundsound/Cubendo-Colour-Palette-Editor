export default function UndoIcon({ size = 16 }) {
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
        <linearGradient id="undoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6AA8FF" />
          <stop offset="100%" stopColor="#A9C7FF" />
        </linearGradient>
      </defs>
      <path d="M8 10H15.5C18.26 10 20.5 12.24 20.5 15C20.5 17.76 18.26 20 15.5 20" stroke="url(#undoGrad)" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M10 13L7 10L10 7" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
