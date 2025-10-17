import { Database } from "@/database.types";
import { CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function supabaseServer(
  cookieStore: ReturnType<typeof cookies>,
  useServiceRole: boolean = false
) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    useServiceRole
      ? process.env.SERVICE_ROLE_KEY || "placeholder-service-key"
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key",
    {
      cookies: {
        async getAll() {
          return (await cookieStore)
            .getAll()
            .map((cookie) => ({ name: cookie.name, value: cookie.value }));
        },
        async setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[]
        ) {
          const store = await cookieStore;
          cookiesToSet.forEach(({ name, value, options }) =>
            store.set(name, value, options)
          );
        },
      },
      auth: useServiceRole
        ? {
            autoRefreshToken: false,
            persistSession: false,
          }
        : undefined,
    }
  );
}
