'use client';

import React, { useEffect, useState } from 'react';

class TabError extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ background: '#fff', border: '2px solid #c0392b', borderRadius: 12, padding: 20, fontFamily: 'monospace' }}>
          <h3 style={{ color: '#c0392b', marginTop: 0 }}>⚠ Tab crash: {this.props.name}</h3>
          <p><b>{this.state.err.name}: {this.state.err.message}</b></p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, maxHeight: 300, overflow: 'auto' }}>{this.state.err.stack}</pre>
          <p style={{ fontFamily: 'sans-serif', fontSize: 13 }}>Is error ka screenshot bhejo.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Dashboard, Orders, InvoicePrint, ManualOrder, Customers, Coupons, Newsletter, Settings } from './components/core';
import { Products } from './components/products';
import { SiteSettings, Menus, Bars, Popups, Offers } from './components/content';
import { Homepage, Collections, ActivityLog } from './components/homepage';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Ticket, Mail,
  Settings as SettingsIcon, Menu as MenuIcon, Megaphone, Bell, Tag, Home,
  FolderOpen, Activity, LogOut, Plus, Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'coupons', label: 'Coupons', icon: Ticket },
  { id: 'newsletter', label: 'Newsletter', icon: Mail },
  { id: 'site', label: 'Site Settings', icon: SettingsIcon },
  { id: 'menus', label: 'Menus', icon: MenuIcon },
  { id: 'bars', label: 'Announcement Bars', icon: Megaphone },
  { id: 'popups', label: 'Popups', icon: Bell },
  { id: 'offers', label: 'Offers', icon: Tag },
  { id: 'homepage', label: 'Homepage', icon: Home },
  { id: 'collections', label: 'Collections', icon: FolderOpen },
  { id: 'activity', label: 'Activity Log', icon: Activity },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.ok) onLogin();
      else setError('Incorrect password. Try again.');
    } catch {
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FAF6EF] to-[#F4EEE2] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-[#1C1A16] flex items-center justify-center">
            <Store className="h-7 w-7 text-[#FAF6EF]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1C1A16]">AMMIGE Admin</h1>
          <p className="text-sm text-[#8A7E6B] mt-1">Sign in to manage your store</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="h-12"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full h-12 bg-[#1C1A16] hover:bg-[#3a352c] text-white" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [showManualOrder, setShowManualOrder] = useState(false);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => { if (r.ok) setAuthed(true); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1C1A16] mx-auto mb-4"></div>
          <p className="text-[#8A7E6B]">Loading admin...</p>
        </div>
      </div>
    );
  }
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
  if (printOrder) return <InvoicePrint order={printOrder} onBack={() => setPrintOrder(null)} />;

  const activeNav = NAV.find((n) => n.id === tab);

  return (
    <div className="min-h-screen bg-[#FAF6EF]">
      {/* Mobile header */}
      <header className="adm-mhead lg:hidden sticky top-0 z-40 bg-white border-b border-[#E8E2D6] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -ml-2 rounded-lg hover:bg-[#F4F0E6] text-[#1C1A16]"
            aria-label="Menu"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
          <span className="font-bold text-lg tracking-wide text-[#1C1A16]">AMMIGE</span>
        </div>
        <button onClick={logout} className="p-2 rounded-lg hover:bg-[#F4F0E6] text-[#1C1A16]" aria-label="Logout">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          'fixed lg:sticky lg:top-0 self-start shrink-0 inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#E8E2D6] transform transition-transform duration-200 lg:translate-x-0 h-screen flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="adm-brand border-b border-[#E8E2D6]">
            <div className="font-bold text-xl tracking-wide text-[#1C1A16]">AMMIGE</div>
            <div className="text-xs text-[#8A7E6B] mt-0.5">Store Manager</div>
          </div>
          <nav className="adm-nav space-y-1 overflow-y-auto flex-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setTab(item.id); setSidebarOpen(false); setShowManualOrder(false); }}
                  className={cn(
                    'adm-navbtn w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all',
                    tab === item.id
                      ? 'bg-[#1C1A16] text-white shadow-sm'
                      : 'text-[#5C5344] hover:bg-[#F4F0E6] hover:text-[#1C1A16]'
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="adm-sidefoot border-t border-[#E8E2D6]">
            <button
              onClick={logout}
              className="adm-navbtn w-full flex items-center gap-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Logout
            </button>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="adm-main flex-1 min-w-0 max-w-[1400px] mx-auto w-full">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-[#1C1A16]">{activeNav?.label || 'Dashboard'}</h1>
              <p className="text-sm text-[#8A7E6B] mt-1">Manage your AMMIGE store</p>
            </div>
            {tab === 'orders' && (
              <Button
                onClick={() => setShowManualOrder(true)}
                className="bg-[#1C1A16] hover:bg-[#3a352c] text-white"
              >
                <Plus className="h-4 w-4 mr-2" /> New Order
              </Button>
            )}
          </div>

          {showManualOrder && tab === 'orders' && (
            <div className="mb-6">
              <ManualOrder onCreated={() => setShowManualOrder(false)} />
            </div>
          )}

          <div className="admin-content">
            {tab === 'dashboard' && <TabError name="Dashboard"><Dashboard /></TabError>}
            {tab === 'orders' && <TabError name="Orders"><Orders onPrint={setPrintOrder} /></TabError>}
            {tab === 'products' && <TabError name="Products"><Products /></TabError>}
            {tab === 'customers' && <TabError name="Customers"><Customers /></TabError>}
            {tab === 'coupons' && <TabError name="Coupons"><Coupons /></TabError>}
            {tab === 'newsletter' && <TabError name="Newsletter"><Newsletter /></TabError>}
            {tab === 'site' && <TabError name="SiteSettings"><SiteSettings /></TabError>}
            {tab === 'menus' && <TabError name="Menus"><Menus /></TabError>}
            {tab === 'bars' && <TabError name="Bars"><Bars /></TabError>}
            {tab === 'popups' && <TabError name="Popups"><Popups /></TabError>}
            {tab === 'offers' && <TabError name="Offers"><Offers /></TabError>}
            {tab === 'homepage' && <TabError name="Homepage"><Homepage /></TabError>}
            {tab === 'collections' && <TabError name="Collections"><Collections /></TabError>}
            {tab === 'activity' && <TabError name="ActivityLog"><ActivityLog /></TabError>}
            {tab === 'settings' && <TabError name="Settings"><Settings /></TabError>}
          </div>
        </main>
      </div>
    </div>
  );
}
