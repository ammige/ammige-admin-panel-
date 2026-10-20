import MuiProvider from './components/MuiProvider';

export const metadata = {
  title: 'AMMIGE Admin',
  description: 'AMMIGE Store Management',
};

export default function AdminLayout({ children }) {
  return <MuiProvider>{children}</MuiProvider>;
}
