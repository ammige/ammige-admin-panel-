import './globals.css';
import { Poppins } from 'next/font/google';

// AMMIGE Admin Panel — standalone app (its own repo/deployment).
// Shares the same backend data layer (lib/) and the same Neon database
// as the storefront; only /admin and /api/admin/* are served here.
const poppins = Poppins({ weight: ['400', '500', '600', '700', '800'], subsets: ['latin'], display: 'swap', variable: '--font-poppins' });

export const metadata = {
  title: 'AMMIGE Admin',
  description: 'AMMIGE Store Management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={poppins.variable} style={{ fontFamily: "var(--font-poppins), 'Poppins', system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
