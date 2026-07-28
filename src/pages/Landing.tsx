import { Link } from 'react-router-dom';
import { Shield, Globe, Play, ArrowRight } from 'lucide-react';
import { theme } from '../lib/theme';

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bgElevated} 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 720, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
          <Play size={40} color={theme.primary} strokeWidth={2} />
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>IPTV Player</span>
        </div>

        <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.15, marginBottom: 16, letterSpacing: -1 }}>
          Your media. Your device.<br />One portal.
        </h1>
        <p style={{ fontSize: 17, color: theme.textMuted, lineHeight: 1.6, marginBottom: 40, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          Manage your playlists, activate your license, and start watching. Admins can oversee every device from a single dashboard.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/portal" style={cardLink}>
            <Globe size={24} color={theme.primary} strokeWidth={2} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Device Portal</div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>Manage playlists & buy license</div>
            </div>
            <ArrowRight size={20} color={theme.textDim} strokeWidth={2} />
          </Link>

          <Link to="/admin" style={cardLink}>
            <Shield size={24} color={theme.accent} strokeWidth={2} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Admin Dashboard</div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>Manage devices & revenue</div>
            </div>
            <ArrowRight size={20} color={theme.textDim} strokeWidth={2} />
          </Link>
        </div>

        <p style={{ marginTop: 48, fontSize: 12, color: theme.textDim }}>
          Enter your MAC address and device key shown on your TV screen to access the device portal.
        </p>
      </div>
    </div>
  );
}

const cardLink: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  backgroundColor: theme.surface,
  borderRadius: 16,
  padding: '20px 24px',
  textDecoration: 'none',
  color: theme.text,
  border: `1px solid ${theme.border}`,
  transition: 'border-color 0.2s, transform 0.2s',
  minWidth: 280,
};
