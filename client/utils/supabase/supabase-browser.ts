import { Database } from "@/database.types";
import { createBrowserClient } from "@supabase/ssr";
import { useMemo } from "react";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

function getSupabaseBrowserClient() {
  if (client) {
    return client;
  }

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
  );

  return client;
}

function useSupabaseBrowser() {
  return useMemo(getSupabaseBrowserClient, []);
}

export default useSupabaseBrowser;
export const createClient = getSupabaseBrowserClient;
