import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Plus, Pencil, Trash2, Lock, Unlock, CreditCard, LogOut, CheckCircle2, X, ArrowLeft } from 'lucide-react';
import { theme } from '../lib/theme';
import {
  authenticateDevice, listPlaylists, createPlaylist, updatePlaylist, deletePlaylist,
  buyLicense, type PlaylistInput,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import type { DeviceRow, PlaylistRow, PlaylistType } from '../lib/supabase';

const STORAGE_KEY = 'iptv_portal_session';

export default function Portal() {
  const [stage, setStage] = useState<'login' | 'dashboard'>('login');
  const [mac, setMac] = useState('');
  const [deviceKey, setDeviceKey] = useState('');
  const [device, setDevice] = useState<DeviceRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [editing, setEditing] = useState<PlaylistRow | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const macParam = params.get('mac');
    if (macParam) setMac(macParam.toUpperCase());
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { mac: string; key: string };
        setMac(parsed.mac);
        setDeviceKey(parsed.key);
        doLogin(parsed.mac, parsed.key, true);
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: if admin activates/bans the device or another session edits
  // playlists, update this dashboard instantly without a manual refresh.
  useEffect(() => {
    if (!device) return;
    const deviceId = device.id;
    const mac = device.mac_address;
    const key = device.device_key;

    const channel = supabase
      .channel('portal-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices', filter: `id=eq.${deviceId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setDevice(payload.new as DeviceRow);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlists', filter: `device_id=eq.${deviceId}` },
        async () => {
          try {
            const plRes = await listPlaylists(mac, key);
            setPlaylists(plRes.playlists);
          } catch { /* ignore */ }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [device?.id]);

  const doLogin = useCallback(async (macAddr: string, key: string, silent = false) => {
    setError(null);
    setLoading(true);
    try {
      const res = await authenticateDevice(macAddr, key);
      setDevice(res.device);
      const plRes = await listPlaylists(macAddr, key);
      setPlaylists(plRes.playlists);
      setStage('dashboard');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mac: macAddr.toUpperCase(), key }));
    } catch (e) {
      if (!silent) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = async () => {
    if (!device) return;
    setLoading(true);
    try {
      const plRes = await listPlaylists(device.mac_address, device.device_key);
      setPlaylists(plRes.playlists);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setStage('login');
    setDevice(null);
    setPlaylists([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const savePlaylist = async (input: PlaylistInput, id?: string) => {
    if (!device) return;
    setLoading(true);
    setError(null);
    try {
      if (id) await updatePlaylist(id, device.mac_address, device.device_key, input);
      else await createPlaylist(device.mac_address, device.device_key, input);
      await refresh();
      setShowEditor(false);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const removePlaylist = async (id: string) => {
    if (!device) return;
    if (!window.confirm('Delete this playlist from your device?')) return;
    setLoading(true);
    try {
      await deletePlaylist(id, device.mac_address, device.device_key);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (stage === 'login') {
    return (
      <div style={pageStyle}>
        <Link to="/" style={backLink}><ArrowLeft size={18} color={theme.textMuted} /> Back to home</Link>
        <div style={loginCard}>
          <div style={logoRow}><Globe size={32} color={theme.primary} /><span style={logoText}>WEB PORTAL</span></div>
          <h1 style={loginTitle}>Manage your device</h1>
          <p style={loginSubtitle}>Enter the MAC address and device key shown on your TV or app screen.</p>
          <label style={fieldLabel}>MAC ADDRESS</label>
          <input style={inputStyle} placeholder="AA:BB:CC:DD:EE:FF" value={mac} onChange={(e) => setMac(e.target.value.toUpperCase())} autoCapitalize="characters" />
          <label style={fieldLabel}>DEVICE KEY (4 DIGITS)</label>
          <input style={{ ...inputStyle, letterSpacing: 4 }} placeholder="0000" value={deviceKey} onChange={(e) => setDeviceKey(e.target.value)} maxLength={4} inputMode="numeric" />
          {error && <div style={errorTextStyle}>{error}</div>}
          <button style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }} onClick={() => doLogin(mac, deviceKey)} disabled={loading}>
            {loading ? 'Loading…' : 'Log in'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pageStyle, alignItems: 'stretch' }}>
      <div style={dashHeader}>
        <div>
          <h1 style={dashTitle}>My Playlists</h1>
          <div style={dashMac}>{device?.mac_address} · {device?.device_type}</div>
        </div>
        <div style={dashActions}>
          <button style={licenseBtn} onClick={() => setShowPayment(true)}>
            <CreditCard size={16} color={theme.bg} />
            {device?.is_activated ? 'License Active' : 'Buy License'}
          </button>
          <button style={iconBtn} onClick={logout}><LogOut size={18} color={theme.textMuted} /></button>
        </div>
      </div>

      <div style={infoCard}>
        <div style={infoItem}><div style={infoLabel}>STATUS</div><div style={{ ...infoValue, color: device?.is_activated ? theme.success : theme.warning }}>{device?.is_activated ? 'Licensed' : 'Trial'}</div></div>
        <div style={infoDivider} />
        <div style={infoItem}><div style={infoLabel}>EXPIRES</div><div style={infoValue}>{device?.license_expires_at ? new Date(device.license_expires_at).toLocaleDateString() : device?.trial_ends_at ? new Date(device.trial_ends_at).toLocaleDateString() : '—'}</div></div>
        <div style={infoDivider} />
        <div style={infoItem}><div style={infoLabel}>PLAYLISTS</div><div style={infoValue}>{playlists.length}</div></div>
      </div>

      {error && <div style={errorTextStyle}>{error}</div>}

      <div style={{ width: '100%', maxWidth: 720, padding: '0 16px' }}>
        {playlists.length === 0 ? (
          <div style={emptyState}>
            <Globe size={40} color={theme.textDim} />
            <div style={emptyTitle}>No playlists yet</div>
            <div style={emptySub}>Add your M3U or Xtream Codes playlist to start watching.</div>
          </div>
        ) : (
          playlists.map((item) => (
            <div key={item.id} style={playlistRow}>
              <div style={playlistIcon}>{item.is_protected ? <Lock size={18} color={theme.primary} /> : <Unlock size={18} color={theme.textMuted} />}</div>
              <div style={{ flex: 1 }}>
                <div style={playlistTitle}>{item.title}</div>
                <div style={playlistMeta}>{item.type === 'm3u_url' ? 'M3U URL' : item.type === 'xtream' ? 'Xtream Codes' : item.type === 'stalker' ? 'Stalker Portal' : 'File'}{item.xc_server_url ? ` · ${item.xc_server_url}` : ''}</div>
              </div>
              <button style={rowBtn} onClick={() => { setEditing(item); setShowEditor(true); }}><Pencil size={16} color={theme.textMuted} /></button>
              <button style={rowBtn} onClick={() => removePlaylist(item.id)}><Trash2 size={16} color={theme.error} /></button>
            </div>
          ))
        )}
        <button style={addBtn} onClick={() => { setEditing(null); setShowEditor(true); }}>
          <Plus size={20} color={theme.bg} /> Add Playlist
        </button>
      </div>

      {showEditor && <PlaylistEditor playlist={editing} onClose={() => { setShowEditor(false); setEditing(null); }} onSave={savePlaylist} />}
      {showPayment && <PaymentModal device={device} onClose={() => setShowPayment(false)} onPaid={() => { setShowPayment(false); if (device) doLogin(device.mac_address, device.device_key, true); }} />}
    </div>
  );
}

function PlaylistEditor({ playlist, onClose, onSave }: { playlist: PlaylistRow | null; onClose: () => void; onSave: (input: PlaylistInput, id?: string) => void }) {
  const [title, setTitle] = useState(playlist?.title || '');
  const [type, setType] = useState<PlaylistType>(playlist?.type || 'm3u_url');
  const [m3uUrl, setM3uUrl] = useState(playlist?.m3u_url || '');
  const [xcServer, setXcServer] = useState(playlist?.xc_server_url || '');
  const [xcUser, setXcUser] = useState(playlist?.xc_username || '');
  const [xcPass, setXcPass] = useState('');
  const [isProtected, setIsProtected] = useState(playlist?.is_protected || false);
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!title.trim()) return setErr('Title is required.');
    if (type === 'm3u_url' && !m3uUrl.trim()) return setErr('M3U URL is required.');
    if (type === 'xtream' && (!xcServer.trim() || !xcUser.trim())) return setErr('Server and username are required for Xtream.');
    if (isProtected && !pin.trim()) return setErr('PIN is required when protection is enabled.');
    setSaving(true);
    try {
      await onSave({
        title: title.trim(), type,
        m3u_url: type === 'm3u_url' ? m3uUrl.trim() : undefined,
        xc_server_url: type === 'xtream' ? xcServer.trim() : undefined,
        xc_username: type === 'xtream' ? xcUser.trim() : undefined,
        xc_password: type === 'xtream' && xcPass ? xcPass : undefined,
        is_protected: isProtected,
        pin_code: isProtected ? pin : undefined,
      }, playlist?.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}><h2 style={modalTitle}>{playlist ? 'Edit Playlist' : 'Add Playlist'}</h2><button onClick={onClose}><X size={22} color={theme.textMuted} /></button></div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <label style={fieldLabel}>NAME</label>
          <input style={inputStyle} placeholder="My Channels" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label style={fieldLabel}>TYPE</label>
          <div style={typeRow}>
            {(['m3u_url', 'xtream', 'stalker'] as PlaylistType[]).map((t) => (
              <button key={t} style={{ ...typeChip, backgroundColor: type === t ? theme.primary : theme.bgElevated, color: type === t ? theme.bg : theme.textMuted }} onClick={() => setType(t)}>
                {t === 'm3u_url' ? 'M3U URL' : t === 'xtream' ? 'Xtream' : 'Stalker'}
              </button>
            ))}
          </div>
          {type === 'm3u_url' && (<><label style={fieldLabel}>M3U / M3U8 URL</label><input style={inputStyle} placeholder="https://example.com/playlist.m3u8" value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} /></>)}
          {type === 'xtream' && (<>
            <label style={fieldLabel}>SERVER URL</label><input style={inputStyle} placeholder="http://server:port" value={xcServer} onChange={(e) => setXcServer(e.target.value)} />
            <label style={fieldLabel}>USERNAME</label><input style={inputStyle} placeholder="username" value={xcUser} onChange={(e) => setXcUser(e.target.value)} />
            <label style={fieldLabel}>PASSWORD {playlist ? '(leave blank to keep)' : ''}</label><input style={inputStyle} type="password" placeholder="password" value={xcPass} onChange={(e) => setXcPass(e.target.value)} />
          </>)}
          {type === 'stalker' && <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 8 }}>Stalker portal URL goes in the M3U URL field.</div>}
          <button style={protectRow} onClick={() => setIsProtected((v) => !v)}>
            {isProtected ? <Lock size={18} color={theme.primary} /> : <Unlock size={18} color={theme.textMuted} />}
            <span style={protectText}>Protect with PIN</span>
          </button>
          {isProtected && (<><label style={fieldLabel}>PIN CODE (4 DIGITS)</label><input style={{ ...inputStyle, letterSpacing: 4 }} placeholder="0000" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={4} inputMode="numeric" /></>)}
          {err && <div style={errorTextStyle}>{err}</div>}
        </div>
        <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} onClick={submit} disabled={saving}>{saving ? 'Saving…' : playlist ? 'Save changes' : 'Add playlist'}</button>
      </div>
    </div>
  );
}

function PaymentModal({ device, onClose, onPaid }: { device: DeviceRow | null; onClose: () => void; onPaid: () => void }) {
  const plans = [
    { id: 'monthly' as const, label: 'Monthly', price: '€4.99', per: '/month' },
    { id: 'yearly' as const, label: 'Yearly', price: '€39.99', per: '/year' },
    { id: 'lifetime' as const, label: 'Lifetime', price: '€99.00', per: ' one-time' },
  ];
  const [selected, setSelected] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const pay = async () => {
    setProcessing(true);
    try {
      await buyLicense(device!.mac_address, device!.device_key, selected);
      setDone(true);
      setTimeout(() => onPaid(), 1200);
    } catch {
      setProcessing(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}><h2 style={modalTitle}>Buy License</h2><button onClick={onClose}><X size={22} color={theme.textMuted} /></button></div>
        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle2 size={48} color={theme.success} />
            <div style={{ color: theme.success, fontSize: 20, fontWeight: 800, marginTop: 12 }}>License activated!</div>
            <div style={{ color: theme.textMuted, fontSize: 14, marginTop: 4 }}>Reload your device to start watching.</div>
          </div>
        ) : (
          <>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>Device: {device?.mac_address}</div>
            {plans.map((p) => (
              <button key={p.id} style={{ ...planRow, borderColor: selected === p.id ? theme.primary : 'transparent' }} onClick={() => setSelected(p.id)}>
                <div><div style={planLabel}>{p.label}</div><div style={planPrice}>{p.price}<span style={planPer}>{p.per}</span></div></div>
                <div style={{ ...radio, borderColor: selected === p.id ? theme.primary : theme.border }}>{selected === p.id && <div style={radioDot} />}</div>
              </button>
            ))}
            <div style={{ color: theme.textDim, fontSize: 12, marginTop: 8 }}>Secure checkout via Stripe. Your license activates instantly after payment.</div>
            <button style={{ ...primaryBtn, opacity: processing ? 0.6 : 1 }} onClick={pay} disabled={processing}>{processing ? 'Processing…' : 'Pay & Activate'}</button>
          </>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' };
const backLink: React.CSSProperties = { position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 6, color: theme.textMuted, fontSize: 14, fontWeight: 600, textDecoration: 'none' };
const loginCard: React.CSSProperties = { width: '100%', maxWidth: 460, background: theme.surface, borderRadius: 18, padding: 28 };
const logoRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 };
const logoText: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: theme.primary, letterSpacing: 2 };
const loginTitle: React.CSSProperties = { fontSize: 24, fontWeight: 800, color: theme.text };
const loginSubtitle: React.CSSProperties = { fontSize: 14, color: theme.textMuted, marginTop: 6, marginBottom: 24, lineHeight: 1.5 };
const fieldLabel: React.CSSProperties = { display: 'block', color: theme.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginTop: 14, textTransform: 'uppercase' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', background: theme.bgElevated, borderRadius: 10, padding: '12px 14px', marginTop: 6, color: theme.text, fontSize: 15, border: `1px solid ${theme.border}`, outline: 'none' };
const errorTextStyle: React.CSSProperties = { color: theme.error, fontSize: 13, marginTop: 12 };
const primaryBtn: React.CSSProperties = { width: '100%', background: theme.primary, color: theme.bg, borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, marginTop: 20, border: 'none', cursor: 'pointer' };
const dashHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 720, padding: '32px 16px 16px' };
const dashTitle: React.CSSProperties = { fontSize: 24, fontWeight: 800, color: theme.text };
const dashMac: React.CSSProperties = { fontSize: 12, color: theme.textDim, marginTop: 2 };
const dashActions: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };
const licenseBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: theme.primary, color: theme.bg, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' };
const iconBtn: React.CSSProperties = { width: 40, height: 40, borderRadius: 10, background: theme.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' };
const infoCard: React.CSSProperties = { display: 'flex', width: '100%', maxWidth: 720, margin: '0 16px', background: theme.surface, borderRadius: 12, padding: 16, alignItems: 'center' };
const infoItem: React.CSSProperties = { flex: 1 };
const infoLabel: React.CSSProperties = { color: theme.textDim, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' };
const infoValue: React.CSSProperties = { color: theme.text, fontSize: 15, fontWeight: 700, marginTop: 4 };
const infoDivider: React.CSSProperties = { width: 1, height: 32, background: theme.border, margin: '0 8px' };
const emptyState: React.CSSProperties = { textAlign: 'center', padding: '60px 24px' };
const emptyTitle: React.CSSProperties = { color: theme.text, fontSize: 18, fontWeight: 700, marginTop: 12 };
const emptySub: React.CSSProperties = { color: theme.textMuted, fontSize: 14, marginTop: 6, lineHeight: 1.5 };
const playlistRow: React.CSSProperties = { display: 'flex', alignItems: 'center', background: theme.surface, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12 };
const playlistIcon: React.CSSProperties = { width: 40, height: 40, borderRadius: 10, background: theme.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const playlistTitle: React.CSSProperties = { color: theme.text, fontSize: 15, fontWeight: 700 };
const playlistMeta: React.CSSProperties = { color: theme.textMuted, fontSize: 12, marginTop: 2 };
const rowBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 8, background: theme.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' };
const addBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: theme.primary, color: theme.bg, borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, marginTop: 16, border: 'none', cursor: 'pointer' };
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 };
const modalCard: React.CSSProperties = { width: '100%', maxWidth: 480, background: theme.surface, borderRadius: 18, padding: 24 };
const modalHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 };
const modalTitle: React.CSSProperties = { fontSize: 20, fontWeight: 800, color: theme.text };
const typeRow: React.CSSProperties = { display: 'flex', gap: 8, marginTop: 8 };
const typeChip: React.CSSProperties = { padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' };
const protectRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, background: 'none', border: 'none', cursor: 'pointer', color: theme.text };
const protectText: React.CSSProperties = { fontSize: 14, fontWeight: 600 };
const planRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.bgElevated, borderRadius: 12, padding: 16, marginBottom: 10, border: '2px solid transparent', cursor: 'pointer', width: '100%', textAlign: 'left' };
const planLabel: React.CSSProperties = { color: theme.text, fontSize: 16, fontWeight: 700 };
const planPrice: React.CSSProperties = { color: theme.textMuted, fontSize: 14, marginTop: 2 };
const planPer: React.CSSProperties = { color: theme.textDim, fontSize: 12 };
const radio: React.CSSProperties = { width: 22, height: 22, borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const radioDot: React.CSSProperties = { width: 10, height: 10, borderRadius: '50%', background: theme.primary };
