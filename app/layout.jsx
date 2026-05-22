import './globals.css';

export const metadata = {
  title: 'Licitatio - Sistema de Licitações',
  description: 'Sistema de gestão de licitações públicas',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
