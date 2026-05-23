import './globals.css';
import ThemeProvider from '../components/ThemeProvider';
import SystemMenu from '../components/SystemMenu';

export const metadata = {
  title: 'Licitatio - Sistema de Licitações',
  description: 'Sistema de gestão de licitações públicas',
};

// Script injetado no <head> que aplica o tema escolhido ANTES do render,
// evitando flash de tema errado (FOUC).
const themeInitScript = `
(function(){
  try {
    var raw = window.localStorage.getItem('licitatio.appearance');
    var prefs = raw ? JSON.parse(raw) : {};
    var theme = prefs.theme || 'system';
    var resolved = theme === 'dark' ? 'dark'
                 : theme === 'light' ? 'light'
                 : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var html = document.documentElement;
    html.setAttribute('data-theme', resolved);
    html.setAttribute('data-theme-pref', theme);
    html.setAttribute('data-color', prefs.color || 'blue');
    html.setAttribute('data-font-size', prefs.fontSize || 'normal');
    html.setAttribute('data-density', prefs.density || 'normal');
  } catch (e) { /* ignore */ }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <SystemMenu />
        </ThemeProvider>
      </body>
    </html>
  );
}
