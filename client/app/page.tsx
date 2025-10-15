import LandingPage from "@/components/LandingPage";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";

export default async function Home() {
  const supabase = await supabaseServer(cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Unauthenticated → show landing page
    return <LandingPage />;
  }

  // Authenticated users will be handled by AuthProvider for routing
  // This prevents flash of content and allows for emulation state consideration
  return <LandingPage />;
}
