import './admin.css';

export const metadata = {
  title: 'AMMIGE Admin',
  description: 'AMMIGE Store Management',
};

export default function AdminLayout({ children }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
