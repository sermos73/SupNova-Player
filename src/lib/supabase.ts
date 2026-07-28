import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const EDGE_BASE = `${supabaseUrl}/functions/v1`;

export type DeviceRow = {
  id: string;
  mac_address: string;
  device_key: string;
  device_model: string | null;
  os_version: string | null;
  device_type: string;
  ip_address: string | null;
  is_activated: boolean;
  trial_ends_at: string | null;
  license_expires_at: string | null;
  is_banned: boolean;
  created_at: string;
  last_ping: string | null;
};

export type PlaylistType = 'm3u_url' | 'xtream' | 'stalker' | 'file';

export type PlaylistRow = {
  id: string;
  device_id: string;
  title: string;
  type: PlaylistType;
  m3u_url: string | null;
  xc_server_url: string | null;
  xc_username: string | null;
  xc_password: string | null;
  is_protected: boolean;
  pin_code: string | null;
  created_at: string;
  updated_at: string;
};
