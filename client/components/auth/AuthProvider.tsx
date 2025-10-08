"use client";

import { useProfile } from "@/lib/api/hooks/useProfiles";
import { Profile } from "@/types";
import { EnhancedAuthContextType, ViewMode } from "@/types/auth";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { Session, User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const AuthContext = createContext<EnhancedAuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const supabase = useSupabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();

  // Fetch user's profile
  const { data: userProfile, isLoading: isEffLoading } = useProfile(
    user?.id || "",
    !!user
  );

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  // View mode emulation state calculations
  const isEmulating = useMemo(() => {
    return !!(
      user?.user_metadata?.emulationMode &&
      user?.user_metadata?.emulationMode !== userProfile?.role
    );
  }, [user?.user_metadata?.emulationMode, userProfile?.role]);

  // activeProfile = user's actual profile (never changes)
  const activeProfile = userProfile as Profile | null;

  // effectiveProfile = profile with emulated view mode
  const effectiveProfile = useMemo(() => {
    if (!userProfile) return null;

    if (isEmulating && user?.user_metadata?.emulationMode) {
      // Return same profile but with emulated role for view mode
      return {
        ...userProfile,
        role: user.user_metadata.emulationMode as Profile["role"],
      } as Profile;
    }

    return userProfile as Profile;
  }, [userProfile, isEmulating, user?.user_metadata?.emulationMode]);

  // Welcome modal logic - show if user hasn't viewed intro
  useEffect(() => {
    if (
      !loading &&
      !isProfileLoading &&
      !isEffLoading &&
      activeProfile &&
      user &&
      !showWelcomeModal // Don't show if already shown
    ) {
      // Check if user hasn't viewed the intro
      if (activeProfile.viewed_intro === false) {
        setShowWelcomeModal(true);
      }
    }
  }, [
    activeProfile,
    loading,
    isProfileLoading,
    isEffLoading,
    user,
    showWelcomeModal,
  ]);

  // Centralized redirect logic based on user's effective profile
  useEffect(() => {
    if (
      !loading &&
      !isProfileLoading &&
      !isEffLoading &&
      effectiveProfile &&
      user
    ) {
      const effectiveRole = effectiveProfile.role;

      // 1. Redirect from home page or other public pages based on role
      if (
        pathname === "/" ||
        pathname === "/get-started" ||
        pathname === "/pricing" ||
        pathname === "/about" ||
        pathname === "/contact" ||
        pathname === "/terms-of-service" ||
        pathname === "/privacy-policy"
      ) {
        if (effectiveRole === "admin" || effectiveRole === "superadmin") {
          router.push("/admin/analytics");
        } else if (effectiveRole === "employee") {
          router.push("/dashboard/trainings");
        }
      }

      // 2. Redirect from dashboard page to trainings
      if (pathname === "/dashboard") {
        router.push("/dashboard/trainings");
      }

      // 3. Redirect admin users from dashboard if not emulating employee view
      if (
        pathname.startsWith("/dashboard") &&
        (activeProfile?.role === "admin" ||
          activeProfile?.role === "superadmin") &&
        !isEmulating
      ) {
        router.push("/admin/analytics");
      }

      // 4. Redirect to dashboard when emulating employee view from admin routes
      if (
        pathname.startsWith("/admin") &&
        isEmulating &&
        effectiveRole === "employee"
      ) {
        router.push("/dashboard/trainings");
      }
    }
  }, [
    effectiveProfile,
    activeProfile,
    isEmulating,
    loading,
    isProfileLoading,
    isEffLoading,
    pathname,
    router,
    user,
  ]);

  // View mode emulation control methods
  const startEmulation = useCallback(
    async (viewMode: ViewMode) => {
      try {
        setIsProfileLoading(true);

        const response = await fetch("/api/emulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewMode }),
        });

        if (response.ok) {
          // Update session with emulation state by refreshing
          await supabase.auth.refreshSession();
          return true;
        }
        return false;
      } catch (error) {
        console.error("View mode emulation failed:", error);
        return false;
      } finally {
        setIsProfileLoading(false);
      }
    },
    [supabase.auth]
  );

  const stopEmulation = useCallback(async () => {
    try {
      setIsProfileLoading(true);

      // Clear emulation state by updating user metadata
      const { error } = await supabase.auth.updateUser({
        data: { emulationMode: null },
      });

      if (error) {
        console.error("Failed to stop emulation:", error);
      }
    } catch (error) {
      console.error("Error stopping emulation:", error);
    } finally {
      setIsProfileLoading(false);
    }
  }, [supabase.auth]);

  const value: EnhancedAuthContextType = {
    // Existing values
    user,
    session,
    loading,
    signOut,

    // New view mode emulation values
    activeProfile,
    effectiveProfile,
    isEmulating,
    isProfileLoading: loading || isProfileLoading || isEffLoading,
    startEmulation,
    stopEmulation,

    // Welcome modal state
    showWelcomeModal,
    setShowWelcomeModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
