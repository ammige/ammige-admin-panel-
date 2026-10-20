'use client';

import React, { useEffect, useState } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, IconButton, Button, Card, CardContent, TextField, Alert,
  CircularProgress, Divider, useMediaQuery, useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import InventoryIcon from '@mui/icons-material/Inventory2';
import PeopleIcon from '@mui/icons-material/People';
import CouponIcon from '@mui/icons-material/ConfirmationNumber';
import MailIcon from '@mui/icons-material/Mail';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import CampaignIcon from '@mui/icons-material/Campaign';
import NotificationsIcon from '@mui/icons-material/Notifications';
import OfferIcon from '@mui/icons-material/LocalOffer';
import HomeIcon from '@mui/icons-material/Home';
import FolderIcon from '@mui/icons-material/FolderOpen';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import StoreIcon from '@mui/icons-material/Storefront';

import { Dashboard, Orders, InvoicePrint, ManualOrder, Customers, Coupons, Newsletter, Settings } from './components/core';
import { Products } from './components/products';
import { SiteSettings, Menus, Bars, Popups, Offers } from './components/content';
import { Homepage, Collections, ActivityLog } from './components/homepage';

class TabError extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <Alert severity="error" sx={{ alignItems: 'flex-start' }}>
          <Typography variant="subtitle2">Tab error: {this.props.name}</Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
            {this.state.err.name}: {this.state.err.message}
          </Typography>
        </Alert>
      );
    }
    return this.props.children;
  }
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'orders', label: 'Orders', icon: ShoppingCartIcon },
  { id: 'products', label: 'Products', icon: InventoryIcon },
  { id: 'customers', label: 'Customers', icon: PeopleIcon },
  { id: 'coupons', label: 'Coupons', icon: CouponIcon },
  { id: 'newsletter', label: 'Newsletter', icon: MailIcon },
  { id: 'site', label: 'Site Settings', icon: TuneIcon },
  { id: 'menus', label: 'Menus', icon: MenuIcon },
  { id: 'bars', label: 'Announcement Bars', icon: CampaignIcon },
  { id: 'popups', label: 'Popups', icon: NotificationsIcon },
  { id: 'offers', label: 'Offers', icon: OfferIcon },
  { id: 'homepage', label: 'Homepage', icon: HomeIcon },
  { id: 'collections', label: 'Collections', icon: FolderIcon },
  { id: 'activity', label: 'Activity Log', icon: HistoryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const DRAWER_WIDTH = 264;

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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 420, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{ mx: 'auto', mb: 2, width: 56, height: 56, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <StoreIcon />
            </Box>
            <Typography variant="h5">AMMIGE Admin</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Sign in to manage your store</Typography>
          </Box>
          <Box component="form" onSubmit={submit}>
            <TextField
              type="password"
              label="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              sx={{ mb: 2 }}
            />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [showManualOrder, setShowManualOrder] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => { if (r.ok) setAuthed(true); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Keep the open section in the URL hash so refresh / back keeps your place
  // and a section can be bookmarked or shared.
  const TAB_KEYS = ['dashboard', 'orders', 'products', 'customers', 'coupons', 'newsletter', 'site', 'menus', 'bars', 'popups', 'offers', 'homepage', 'collections', 'activity', 'settings'];
  useEffect(() => {
    const h = window.location.hash.replace('#', '');
    if (TAB_KEYS.includes(h)) setTab(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (authed) { try { history.replaceState(null, '', '#' + tab); } catch { /* ignore */ } }
  }, [tab, authed]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
  };

  if (checking) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
        <Typography color="text.secondary">Loading admin…</Typography>
      </Box>
    );
  }
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
  if (printOrder) return <InvoicePrint order={printOrder} onBack={() => setPrintOrder(null)} />;

  const activeNav = NAV.find((n) => n.id === tab);
  const go = (id) => { setTab(id); setSidebarOpen(false); setShowManualOrder(false); };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2.5, pb: 1.5 }}>
        <Typography variant="h6" sx={{ letterSpacing: '0.08em' }}>AMMIGE</Typography>
        <Typography variant="caption" color="text.secondary">Store Manager</Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const selected = tab === item.id;
          return (
            <ListItemButton
              key={item.id}
              selected={selected}
              onClick={() => go(item.id)}
              sx={{
                borderRadius: 2, mb: 0.25,
                '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' } },
                '&.Mui-selected .MuiListItemIcon-root': { color: 'primary.contrastText' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: selected ? 'inherit' : 'text.secondary' }}><Icon fontSize="small" /></ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 600 : 500 }} />
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      <List sx={{ px: 1, py: 1 }}>
        <ListItemButton onClick={logout} sx={{ borderRadius: 2, color: 'error.main' }}>
          <ListItemIcon sx={{ minWidth: 38, color: 'error.main' }}><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider',
          width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { lg: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>{activeNav?.label || 'Dashboard'}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Manage your AMMIGE store</Typography>
          </Box>
          {tab === 'orders' && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowManualOrder(true)}>
              New Order
            </Button>
          )}
          {isDesktop && (
            <IconButton onClick={logout} aria-label="Logout" color="error">
              <LogoutIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{ display: { xs: 'none', lg: 'block' }, width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' } }}
        open
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flex: 1, minWidth: 0, width: '100%', maxWidth: 1440, mx: 'auto', p: { xs: 2, sm: 3, lg: 4 } }}>
        <Toolbar sx={{ mb: 1 }} />
        {showManualOrder && tab === 'orders' && (
          <Box sx={{ mb: 3 }}>
            <ManualOrder onCreated={() => setShowManualOrder(false)} />
          </Box>
        )}
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
      </Box>
    </Box>
  );
}
