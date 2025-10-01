import LandingPage from "@/components/LandingPage";
import createServerClient from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Unauthenticated → show landing page
    return <LandingPage />;
  }

  // Fetch role in one cheap call
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdminView =
    profile?.role === "admin" || profile?.role === "superadmin";

  redirect(isAdminView ? "/admin/analytics" : "/dashboard/trainings");
}
