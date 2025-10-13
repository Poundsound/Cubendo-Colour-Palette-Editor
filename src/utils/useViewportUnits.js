// A tiny hook to keep a CSS var --vh in sync with the visible viewport height.
// This fixes Safari/macOS and other engines where 100vh includes browser UI.
// Prefer using 100dvh in CSS and fall back to calc(var(--vh) * 100).
import { useEffect } from 'react';

function setVhVar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

export function useViewportUnits() {
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(setVhVar);
    };

    setVhVar();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    window.addEventListener('pageshow', onResize, { passive: true }); // Safari bfcache

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('pageshow', onResize);
    };
  }, []);
}
