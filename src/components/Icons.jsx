/* Reusable SVG icons for the app. Keep them tiny, crisp, and themeable via props.
 * Usage: <UploadIcon size={20} color="#aaa" />
 */

import React from 'react';

const toPx = (n) => (typeof n === 'number' ? `${n}px` : n || '16px');

export function UploadIcon({ size = 16, color = '#bbb', strokeWidth = 2, style }) {
  const s = toPx(size);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path d="M12 16V4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M7 9l5-5 5 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function FileIcon({ size = 16, color = '#bbb', strokeWidth = 2, style }) {
  const s = toPx(size);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path d="M6 2h7l5 5v15H6z" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <path d="M13 2v6h6" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </svg>
  );
}

export function FolderIcon({ size = 16, color = '#bbb', strokeWidth = 2, style }) {
  const s = toPx(size);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </svg>
  );
}

export function BulbIcon({ size = 16, color = '#bbb', strokeWidth = 2, style }) {
  const s = toPx(size);
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path d="M9 18h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M10 22h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M12 2a7 7 0 0 0-5 11.9V17h10v-3.1A7 7 0 0 0 12 2z" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </svg>
  );
}

export default { UploadIcon, FileIcon, FolderIcon, BulbIcon };
