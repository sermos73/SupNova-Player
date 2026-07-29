import { EDGE_BASE, supabase, type DeviceRow, type PlaylistRow, type PlaylistType } from './supabase';

async function getAdminToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${EDGE_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

async function adminCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAdminToken();
  if (!token) throw new Error('Not authenticated. Please sign in.');
  return call<T>(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
}

export async function authenticateDevice(macAddress: string, deviceKey: string) {
  return call<{ device: DeviceRow }>('/device/authenticate', {
    method: 'POST',
    body: JSON.stringify({ macAddress, deviceKey }),
  });
}

export type PlaylistInput = {
  title: string;
  type: PlaylistType;
  m3u_url?: string;
  xc_server_url?: string;
  xc_username?: string;
  xc_password?: string;
  is_protected?: boolean;
  pin_code?: string;
};

export async function listPlaylists(macAddress: string, deviceKey: string) {
  const q = new URLSearchParams({ mac: macAddress.toUpperCase(), key: deviceKey });
  return call<{ playlists: PlaylistRow[] }>(`/playlists?${q.toString()}`, { method: 'GET' });
}

export async function createPlaylist(macAddress: string, deviceKey: string, input: PlaylistInput) {
  return call<{ playlist: PlaylistRow }>('/playlists', {
    method: 'POST',
    body: JSON.stringify({ ...input, macAddress, deviceKey }),
  });
}

export async function updatePlaylist(id: string, macAddress: string, deviceKey: string, input: PlaylistInput) {
  return call<{ playlist: PlaylistRow }>(`/playlists/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...input, macAddress, deviceKey }),
  });
}

export async function deletePlaylist(id: string, macAddress: string, deviceKey: string) {
  const q = new URLSearchParams({ mac: macAddress.toUpperCase(), key: deviceKey });
  return call<{ success: boolean }>(`/playlists/${id}?${q.toString()}`, { method: 'DELETE' });
}

export async function buyLicense(macAddress: string, deviceKey: string, plan: 'monthly' | 'yearly' | 'lifetime') {
  return call<{ device: DeviceRow }>('/device/buy', {
    method: 'POST',
    body: JSON.stringify({ macAddress, deviceKey, plan }),
  });
}

export type AdminStats = {
  total: number;
  active: number;
  trial: number;
  expired: number;
  banned: number;
  byType: Record<string, number>;
  byContent: Record<string, number>;
  totalRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  lifetimeRevenue: number;
  pendingPayments: number;
  totalPlaylists: number;
  resellers: { id: string; email: string; credits: number }[];
};

export async function adminStats() {
  return adminCall<AdminStats>('/admin/stats', { method: 'GET' });
}

export async function adminDevices() {
  return adminCall<{ devices: DeviceRow[] }>('/admin/devices', { method: 'GET' });
}

export async function adminActivate(mac: string, plan: 'monthly' | 'yearly' | 'lifetime') {
  return adminCall<{ device: DeviceRow }>('/admin/activate', {
    method: 'POST',
    body: JSON.stringify({ mac, plan }),
  });
}

export async function adminBan(mac: string) {
  return adminCall<{ success: boolean }>('/admin/ban', { method: 'POST', body: JSON.stringify({ mac }) });
}

export async function adminUnban(mac: string) {
  return adminCall<{ success: boolean }>('/admin/unban', { method: 'POST', body: JSON.stringify({ mac }) });
}
