import { Database } from "@/database.types";
import { CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function supabaseServer(useServiceRole: boolean = false) {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    useServiceRole
      ? process.env.SERVICE_ROLE_KEY!
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore
            .getAll()
            .map((cookie) => ({ name: cookie.name, value: cookie.value }));
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
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
