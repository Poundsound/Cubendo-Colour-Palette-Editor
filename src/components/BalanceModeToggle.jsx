import { useState } from 'react';

export function BalanceModeToggle({ isGentle, onToggle, disabled, isBalancing }) {
  const knobLeft = isGentle ? 40 : 4;
  const knobColor = isGentle ? '#f2994a' : '#2ecc71';
  const borderColor = isGentle ? '#3a3a3a' : '#3a3a3a';
  const baseBackground = '#1f1f1f';
  const hoverBackground = '#262626';
  const [background, setBackground] = useState(baseBackground);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isGentle}
      disabled={disabled}
      title={isGentle ? 'Switch back to harmonise mode' : 'Switch to pastelise mode to preserve saturation'}
      style={{
        width: 72,
        height: 32,
        borderRadius: 999,
        border: `1px solid ${borderColor}`,
        background,
        position: 'relative',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.2s ease',
        outline: 'none',
      }}
      onMouseEnter={() => {
        if (disabled) return;
        setBackground(hoverBackground);
      }}
      onMouseLeave={() => {
        setBackground(baseBackground);
      }}
      onFocus={() => {
        if (disabled) return;
        setBackground(hoverBackground);
      }}
      onBlur={() => setBackground(baseBackground)}
      aria-label={isGentle ? 'Gentle pastelise mode selected. Activate to switch to harmonise.' : 'Harmonise mode selected. Activate to switch to pastelise.'}
    >
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: knobLeft,
          width: 28,
          height: 24,
          borderRadius: 999,
          background: knobColor,
          boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
          transition: 'left 0.2s ease, background 0.2s ease',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6px',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2ecc71', opacity: isGentle ? 0.28 : 0.8, transition: 'opacity 0.2s ease' }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f2994a', opacity: isGentle ? 0.8 : 0.28, transition: 'opacity 0.2s ease' }} />
      </span>
      {isBalancing && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            border: '2px solid rgba(255,255,255,0.15)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
