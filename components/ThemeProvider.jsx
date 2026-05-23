'use client';

// components/ThemeProvider.jsx
// Lê as preferências de aparência do localStorage e aplica como data-attributes
// na tag <html>. As regras visuais ficam no globals.css.
//
// Atributos aplicados:
//   data-theme="light" | "dark" | "system"  (sistema usa prefers-color-scheme)
//   data-color="blue" | "green" | "purple" | "orange" | "slate"
//   data-font-size="small" | "normal" | "large"
//   data-density="compact" | "normal" | "comfortable"

import { useEffect } from 'react';

const STORAGE_KEY = 'licitatio.appearance';

const DEFAULTS = { theme: 'system', color: 'blue', fontSize: 'normal', density: 'normal' };

function resolveTheme(theme) {
  if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'dark' ? 'dark' : 'light';
}

function applyPrefs(prefs) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.setAttribute('data-theme', resolveTheme(prefs.theme));
  html.setAttribute('data-theme-pref', prefs.theme);
  html.setAttribute('data-color', prefs.color);
  html.setAttribute('data-font-size', prefs.fontSize);
  html.setAttribute('data-density', prefs.density);
}

export default function ThemeProvider({ children }) {
  useEffect(() => {
    let prefs = { ...DEFAULTS };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) prefs = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {
      // ignore
    }
    applyPrefs(prefs);

    function onChange(e) {
      if (e.detail) applyPrefs({ ...DEFAULTS, ...e.detail });
    }
    function onStorage(e) {
      if (e.key === STORAGE_KEY) {
        try { applyPrefs({ ...DEFAULTS, ...JSON.parse(e.newValue || '{}') }); } catch (_) {}
      }
    }
    // Quando o tema é "system", reage à mudança do SO
    const mql = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
    function onSystemChange() {
      const pref = document.documentElement.getAttribute('data-theme-pref');
      if (pref === 'system') {
        document.documentElement.setAttribute('data-theme', mql.matches ? 'dark' : 'light');
      }
    }

    window.addEventListener('licitatio.appearance.change', onChange);
    window.addEventListener('storage', onStorage);
    if (mql && mql.addEventListener) mql.addEventListener('change', onSystemChange);

    return () => {
      window.removeEventListener('licitatio.appearance.change', onChange);
      window.removeEventListener('storage', onStorage);
      if (mql && mql.removeEventListener) mql.removeEventListener('change', onSystemChange);
    };
  }, []);

  return children;
}
