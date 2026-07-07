import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* Supabase 환경변수가 모두 설정된 경우에만 원격 모드로 동작합니다.
   설정이 없으면 앱은 자동으로 localStorage(로컬 단일 기기) 모드로 되돌아갑니다. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
