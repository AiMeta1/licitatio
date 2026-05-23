'use client';

// components/SystemMenu.jsx
// Botão flutuante de engrenagem (canto superior direito) com dropdown contendo:
//  - Atalho para gestão de usuários
//  - Configurações visuais: tema, cor de destaque, fonte, densidade
// As escolhas são persistidas em localStorage e aplicadas pelo ThemeProvider.

import { useEffect, useState } from 'react';
import {
  Settings, Users, Sun, Moon, Monitor, Type, LayoutGrid, Palette, X,
} from 'lucide-react';

const STORAGE_KEY = 'licitatio.appearance';

const THEMES = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

const COLORS = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-600' },
  { value: 'green', label: 'Verde', class: 'bg-emerald-600' },
  { value: 'purple', label: 'Roxo', class: 'bg-purple-600' },
  { value: 'orange', label: 'Laranja', class: 'bg-orange-600' },
  { value: 'slate', label: 'Cinza', class: 'bg-slate-700' },
];

const FONT_SIZES = [
  { value: 'small', label: 'Pequena' },
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Grande' },
];

const DENSITIES = [
  { value: 'compact', label: 'Compacta' },
  { value: 'normal', label: 'Normal' },
  { value: 'comfortable', label: 'Confortável' },
];

function loadPrefs() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return { theme: 'system', color: 'blue', fontSize: 'normal', density: 'normal' };
}

function savePrefs(p) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    // dispara para o ThemeProvider reagir na mesma aba
    window.dispatchEvent(new CustomEvent('licitatio.appearance.change', { detail: p }));
  } catch (e) {
    // ignore
  }
}

export default function SystemMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(() => loadPrefs() || { theme: 'system', color: 'blue', fontSize: 'normal', density: 'normal' });

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  // fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!e.target.closest('[data-system-menu]')) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const Section = ({ icon: Icon, title, children }) => (
    <div className="px-4 py-3 border-b border-slate-200 last:border-b-0">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        <Icon size={14} /> {title}
      </div>
      {children}
    </div>
  );

  const Pill = ({ active, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-3 py-1.5 rounded-md text-sm border transition-colors ' +
        (active
          ? 'bg-blue-600 text-white border-blue-600 sm-primary-bg'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')
      }
    >
      {children}
    </button>
  );

  return (
    <div data-system-menu className="fixed top-4 right-4 z-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Configurações do sistema"
        className="bg-white hover:bg-slate-50 border border-slate-300 shadow-md rounded-full w-11 h-11 flex items-center justify-center text-slate-600 hover:text-slate-900 sm-floating"
      >
        <Settings size={20} className={open ? 'rotate-45 transition-transform' : 'transition-transform'} />
      </button>

      {open ? (
        <div className="absolute top-12 right-0 w-80 bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">Configurações</h2>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          <Section icon={Users} title="Sistema">
            <a
              href="/admin/usuarios"
              className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 hover:underline"
            >
              <Users size={16} /> Gestão de usuários
            </a>
          </Section>

          <Section icon={Sun} title="Tema">
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <Pill
                  key={t.value}
                  active={prefs.theme === t.value}
                  onClick={() => setPrefs((p) => ({ ...p, theme: t.value }))}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <t.icon size={14} /> {t.label}
                  </span>
                </Pill>
              ))}
            </div>
          </Section>

          <Section icon={Palette} title="Cor de destaque">
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, color: c.value }))}
                  className={
                    `w-8 h-8 rounded-full ${c.class} ring-offset-2 transition-shadow ` +
                    (prefs.color === c.value ? 'ring-2 ring-slate-900' : 'hover:ring-2 hover:ring-slate-300')
                  }
                  aria-label={c.label}
                  title={c.label}
                />
              ))}
            </div>
          </Section>

          <Section icon={Type} title="Tamanho da fonte">
            <div className="flex gap-2">
              {FONT_SIZES.map((f) => (
                <Pill
                  key={f.value}
                  active={prefs.fontSize === f.value}
                  onClick={() => setPrefs((p) => ({ ...p, fontSize: f.value }))}
                >
                  {f.label}
                </Pill>
              ))}
            </div>
          </Section>

          <Section icon={LayoutGrid} title="Densidade">
            <div className="flex gap-2">
              {DENSITIES.map((d) => (
                <Pill
                  key={d.value}
                  active={prefs.density === d.value}
                  onClick={() => setPrefs((p) => ({ ...p, density: d.value }))}
                >
                  {d.label}
                </Pill>
              ))}
            </div>
          </Section>

          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPrefs({ theme: 'system', color: 'blue', fontSize: 'normal', density: 'normal' })}
              className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
            >
              Restaurar padrões
            </button>
            <span className="text-xs text-slate-400">Salvo automaticamente</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
