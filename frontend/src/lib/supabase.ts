import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createServiceRoleClient(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    getEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

let browserClient: SupabaseClient | null = null;

export function createPublicClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      getEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
      getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey),
    );
  }

  return browserClient;
}
