import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Users, Ban, CheckCircle2, DollarSign, Clock, AlertTriangle, X, Search, Smartphone, Tv, Monitor, ArrowLeft, LogOut, Lock, Mail } from 'lucide-react';
import { theme } from '../lib/theme';
import { adminStats, adminDevices, adminActivate, adminBan, adminUnban, type AdminStats } from '../lib/api';
import type { DeviceRow } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

const DEVICE_TYPE_LABELS: Record<string, string> = {
  smartphone: 'Smartphone', tablet: 'Tablet', tv: 'Smart TV', stb: 'Set-top Box', web: 'Web', unknown: 'Unknown',
};
const CONTENT_TYPE_LABELS: Record<string, string> = {
  m3u_url: 'M3U URL', xtream: 'Xtream Codes', stalker: 'Stalker Portal', file: 'File Upload',
};

function deviceIcon(type: string) {
  switch (type) {
    case 'smartphone': return <Smartphone size={16} color={theme.primary} />;
    case 'tv': return <Tv size={16} color={theme.primary} />;
    default: return <Monitor size={16} color={theme.primary} />;
  }
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activating, setActivating] = useState<DeviceRow | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setAuthLoading(false); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const doLogin = async () => {
    setLoginError(null);
    setLoginBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setLoginBusy(false);
    }
  };

  const doLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setStats(null);
    setDevices([]);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d] = await Promise.all([adminStats(), adminDevices()]);
      setStats(s);
      setDevices(d.devices);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (session) load(); }, [session, load]);

  // Realtime: refresh stats and device list instantly when any device,
  // playlist, or transaction changes across the platform.
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const filtered = devices.filter((d) => d.mac_address.includes(search.toUpperCase()) || (d.device_type || '').includes(search.toLowerCase()));
  const ban = async (mac: string) => { await adminBan(mac); await load(); };
  const unban = async (mac: string) => { await adminUnban(mac); await load(); };

  if (authLoading) return <div style={{ ...pageStyle, justifyContent: 'center' }}><div style={{ color: theme.primary }}>Loading…</div></div>;

  if (!session) {
    return (
      <div style={pageStyle}>
        <Link to="/" style={backLink}><ArrowLeft size={18} color={theme.textMuted} /> Back to home</Link>
        <div style={loginCard}>
          <div style={logoRow}><Shield size={32} color={theme.primary} /><span style={logoText}>ADMIN</span></div>
          <h1 style={loginTitle}>Admin Dashboard</h1>
          <p style={loginSubtitle}>Sign in with your admin email and password to manage devices, licenses, and payments.</p>
          <label style={fieldLabel}>EMAIL</label>
          <div style={inputRow}><Mail size={18} color={theme.textDim} /><input style={inputInline} placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
          <label style={fieldLabel}>PASSWORD</label>
          <div style={inputRow}><Lock size={18} color={theme.textDim} /><input style={inputInline} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {loginError && <div style={errorTextStyle}>{loginError}</div>}
          <button style={{ ...primaryBtn, opacity: loginBusy ? 0.6 : 1 }} onClick={doLogin} disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </div>
    );
  }

  if (loading && !stats) return <div style={{ ...pageStyle, justifyContent: 'center' }}><div style={{ color: theme.primary }}>Loading dashboard…</div></div>;

  return (
    <div style={{ ...pageStyle, alignItems: 'stretch', justifyContent: 'flex-start' }}>
      <div style={header}>
        <div style={headerLeft}><Link to="/" style={iconBtn}><ArrowLeft size={18} color={theme.textMuted} /></Link><Shield size={24} color={theme.primary} /><span style={headerTitle}>Admin Dashboard</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={refreshBtn} onClick={load}>Refresh</button>
          <button style={iconBtn} onClick={doLogout}><LogOut size={18} color={theme.textMuted} /></button>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 960, padding: '0 16px' }}>
        {error && <div style={errorTextStyle}>{error}</div>}

        <div style={statsGrid}>
          <StatCard icon={<Users size={20} color={theme.primary} />} label="Total Devices" value={stats?.total ?? 0} />
          <StatCard icon={<CheckCircle2 size={20} color={theme.success} />} label="Active" value={stats?.active ?? 0} />
          <StatCard icon={<Clock size={20} color={theme.warning} />} label="Trial" value={stats?.trial ?? 0} />
          <StatCard icon={<AlertTriangle size={20} color={theme.error} />} label="Expired" value={stats?.expired ?? 0} />
          <StatCard icon={<Ban size={20} color={theme.error} />} label="Banned" value={stats?.banned ?? 0} />
        </div>

        <h2 style={sectionTitle}>Revenue</h2>
        <div style={revenueCard}>
          <div style={revenueMain}><DollarSign size={22} color={theme.success} /><div><div style={revenueTotal}>€{(stats?.totalRevenue ?? 0).toFixed(2)}</div><div style={revenueLabel}>Total Revenue</div></div></div>
          <div style={revenueBreakdown}>
            <RevenueItem label="Monthly" value={stats?.monthlyRevenue ?? 0} />
            <RevenueItem label="Yearly" value={stats?.yearlyRevenue ?? 0} />
            <RevenueItem label="Lifetime" value={stats?.lifetimeRevenue ?? 0} />
            <RevenueItem label="Pending" value={stats?.pendingPayments ?? 0} isCount />
          </div>
        </div>

        <h2 style={sectionTitle}>Device Types</h2>
        <div style={breakdownRow}>
          {Object.entries(stats?.byType || {}).map(([type, count]) => (
            <div key={type} style={breakdownChip}>{deviceIcon(type)}<span style={breakdownLabel}>{DEVICE_TYPE_LABELS[type] || type}</span><span style={breakdownCount}>{count}</span></div>
          ))}
          {Object.keys(stats?.byType || {}).length === 0 && <span style={{ color: theme.textDim, fontSize: 13 }}>No devices yet.</span>}
        </div>

        <h2 style={sectionTitle}>Content Types</h2>
        <div style={breakdownRow}>
          {Object.entries(stats?.byContent || {}).map(([type, count]) => (
            <div key={type} style={breakdownChip}><Monitor size={16} color={theme.primary} /><span style={breakdownLabel}>{CONTENT_TYPE_LABELS[type] || type}</span><span style={breakdownCount}>{count}</span></div>
          ))}
          {Object.keys(stats?.byContent || {}).length === 0 && <span style={{ color: theme.textDim, fontSize: 13 }}>No playlists yet.</span>}
        </div>

        <h2 style={sectionTitle}>Devices</h2>
        <div style={searchBar}><Search size={18} color={theme.textDim} /><input style={searchInput} placeholder="Search MAC or type…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>

        <div style={{ marginTop: 12 }}>
          {filtered.map((item) => {
            const trialActive = item.trial_ends_at && new Date(item.trial_ends_at).getTime() > Date.now();
            const licActive = item.is_activated && item.license_expires_at && new Date(item.license_expires_at).getTime() > Date.now();
            return (
              <div key={item.id} style={deviceRow}>
                <div style={{ flex: 1 }}>
                  <div style={deviceMacRow}>{deviceIcon(item.device_type)}<span style={deviceMac}>{item.mac_address}</span></div>
                  <div style={deviceMeta}>{DEVICE_TYPE_LABELS[item.device_type] || item.device_type} · {item.device_model || 'Unknown'}</div>
                  <div style={statusRow}>
                    {item.is_banned ? <Pill color={theme.error} text="Banned" /> : licActive ? <Pill color={theme.success} text="Active" /> : trialActive ? <Pill color={theme.warning} text="Trial" /> : <Pill color={theme.textDim} text="Expired" />}
                    <span style={deviceKey}>Key: {item.device_key}</span>
                  </div>
                </div>
                <div style={deviceActions}>
                  <button style={actBtn} onClick={() => setActivating(item)}>Activate</button>
                  {item.is_banned ? (
                    <button style={{ ...actBtn, background: `${theme.success}22`, color: theme.success }} onClick={() => unban(item.mac_address)}>Unban</button>
                  ) : (
                    <button style={{ ...actBtn, background: `${theme.error}22`, color: theme.error }} onClick={() => ban(item.mac_address)}>Ban</button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ color: theme.textDim, fontSize: 13, padding: 16 }}>No devices found.</div>}
        </div>
      </div>

      {activating && <ActivateModal device={activating} onClose={() => setActivating(null)} onDone={() => { setActivating(null); load(); }} />}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (<div style={statCard}>{icon}<div style={statValue}>{value}</div><div style={statLabel}>{label}</div></div>);
}

function RevenueItem({ label, value, isCount }: { label: string; value: number; isCount?: boolean }) {
  return (<div style={revenueItem}><div style={revenueItemLabel}>{label}</div><div style={revenueItemValue}>{isCount ? value : `€${value.toFixed(2)}`}</div></div>);
}

function Pill({ color, text }: { color: string; text: string }) {
  return (<span style={{ padding: '3px 8px', borderRadius: 6, background: `${color}22`, color, fontSize: 11, fontWeight: 700 }}>{text}</span>);
}

function ActivateModal({ device, onClose, onDone }: { device: DeviceRow; onClose: () => void; onDone: () => void }) {
  const [plan, setPlan] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activate = async () => {
    setBusy(true); setErr(null);
    try { await adminActivate(device.mac_address, plan); onDone(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}><h2 style={modalTitle}>Activate License</h2><button onClick={onClose}><X size={22} color={theme.textMuted} /></button></div>
        <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>{device.mac_address} · {DEVICE_TYPE_LABELS[device.device_type] || device.device_type}</div>
        {(['monthly', 'yearly', 'lifetime'] as const).map((p) => (
          <button key={p} style={{ ...planRow, borderColor: plan === p ? theme.primary : 'transparent' }} onClick={() => setPlan(p)}>
            <span style={planLabel}>{p[0].toUpperCase() + p.slice(1)}</span>
            <span style={{ ...radio, borderColor: plan === p ? theme.primary : theme.border }}>{plan === p && <span style={radioDot} />}</span>
          </button>
        ))}
        {err && <div style={errorTextStyle}>{err}</div>}
        <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={activate} disabled={busy}>{busy ? 'Activating…' : 'Activate'}</button>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' };
const backLink: React.CSSProperties = { position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 6, color: theme.textMuted, fontSize: 14, fontWeight: 600, textDecoration: 'none' };
const loginCard: React.CSSProperties = { width: '100%', maxWidth: 460, background: theme.surface, borderRadius: 18, padding: 28 };
const logoRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 };
const logoText: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: theme.primary, letterSpacing: 2 };
const loginTitle: React.CSSProperties = { fontSize: 24, fontWeight: 800, color: theme.text };
const loginSubtitle: React.CSSProperties = { fontSize: 14, color: theme.textMuted, marginTop: 6, marginBottom: 24, lineHeight: 1.5 };
const fieldLabel: React.CSSProperties = { display: 'block', color: theme.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginTop: 14, textTransform: 'uppercase' };
const inputRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: theme.bgElevated, borderRadius: 10, padding: '12px 14px', marginTop: 6, border: `1px solid ${theme.border}` };
const inputInline: React.CSSProperties = { flex: 1, background: 'none', border: 'none', color: theme.text, fontSize: 15, outline: 'none' };
const errorTextStyle: React.CSSProperties = { color: theme.error, fontSize: 13, marginTop: 8 };
const primaryBtn: React.CSSProperties = { width: '100%', background: theme.primary, color: theme.bg, borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, marginTop: 16, border: 'none', cursor: 'pointer' };
const header: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 960, padding: '32px 16px 16px' };
const headerLeft: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const headerTitle: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: theme.text };
const refreshBtn: React.CSSProperties = { background: theme.surface, color: theme.primary, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' };
const iconBtn: React.CSSProperties = { width: 40, height: 40, borderRadius: 10, background: theme.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', textDecoration: 'none' };
const sectionTitle: React.CSSProperties = { color: theme.textMuted, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginTop: 24, marginBottom: 10 };
const statsGrid: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10 };
const statCard: React.CSSProperties = { flexGrow: 1, minWidth: 140, background: theme.surface, borderRadius: 12, padding: 14 };
const statValue: React.CSSProperties = { color: theme.text, fontSize: 24, fontWeight: 800, marginTop: 6 };
const statLabel: React.CSSProperties = { color: theme.textMuted, fontSize: 11, marginTop: 2 };
const revenueCard: React.CSSProperties = { background: theme.surface, borderRadius: 14, padding: 18 };
const revenueMain: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 };
const revenueTotal: React.CSSProperties = { color: theme.success, fontSize: 26, fontWeight: 800 };
const revenueLabel: React.CSSProperties = { color: theme.textMuted, fontSize: 13, marginTop: 2 };
const revenueBreakdown: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const revenueItem: React.CSSProperties = { flexGrow: 1, minWidth: 120, background: theme.bgElevated, borderRadius: 10, padding: 12 };
const revenueItemLabel: React.CSSProperties = { color: theme.textDim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' };
const revenueItemValue: React.CSSProperties = { color: theme.text, fontSize: 16, fontWeight: 700, marginTop: 4 };
const breakdownRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10 };
const breakdownChip: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, background: theme.surface, borderRadius: 20, padding: '8px 14px' };
const breakdownLabel: React.CSSProperties = { color: theme.text, fontSize: 13, fontWeight: 600 };
const breakdownCount: React.CSSProperties = { color: theme.primary, fontSize: 14, fontWeight: 800 };
const searchBar: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: theme.surface, borderRadius: 10, padding: '10px 14px' };
const searchInput: React.CSSProperties = { flex: 1, background: 'none', border: 'none', color: theme.text, fontSize: 14, outline: 'none' };
const deviceRow: React.CSSProperties = { display: 'flex', alignItems: 'center', background: theme.surface, borderRadius: 12, padding: 14, marginBottom: 10, gap: 10 };
const deviceMacRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const deviceMac: React.CSSProperties = { color: theme.text, fontSize: 14, fontWeight: 700 };
const deviceMeta: React.CSSProperties = { color: theme.textMuted, fontSize: 12, marginTop: 4 };
const statusRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 };
const deviceKey: React.CSSProperties = { color: theme.textDim, fontSize: 11 };
const deviceActions: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const actBtn: React.CSSProperties = { background: `${theme.primary}22`, color: theme.primary, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' };
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 };
const modalCard: React.CSSProperties = { width: '100%', maxWidth: 420, background: theme.surface, borderRadius: 18, padding: 24 };
const modalHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 };
const modalTitle: React.CSSProperties = { fontSize: 20, fontWeight: 800, color: theme.text };
const planRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.bgElevated, borderRadius: 10, padding: 14, marginBottom: 8, border: '2px solid transparent', cursor: 'pointer', width: '100%' };
const planLabel: React.CSSProperties = { color: theme.text, fontSize: 15, fontWeight: 700 };
const radio: React.CSSProperties = { width: 22, height: 22, borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const radioDot: React.CSSProperties = { width: 10, height: 10, borderRadius: '50%', background: theme.primary, display: 'block' };
