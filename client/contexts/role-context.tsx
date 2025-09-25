"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import type { Database } from "@/database.types";
import { usePersonas } from "@/lib/api/hooks/usePersonas";
import { useProfile } from "@/lib/api/hooks/useProfiles";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import React, { createContext, useContext, useEffect, useState } from "react";

type UserRole = Database["public"]["Enums"]["user_role"];

interface RoleContextType {
  userRole: UserRole | null;
  loading: boolean;
  switchToEmployee: () => void;
  switchToAdmin: () => void;
  currentView: "employee" | "admin";
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const supabase = useSupabaseBrowser();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<"employee" | "admin">(
    "employee"
  );
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Check if user has viewed intro
  const { data: profile, isLoading: profileLoading } = useProfile(
    user?.id || "",
    !!user
  );
  const hasViewedIntro = profile?.viewed_intro || false;

  // Check if user has complete persona data
  const { data: personas, isLoading: personasLoading } = usePersonas(
    user?.id || ""
  );
  const hasCompletePersona =
    personas &&
    personas.length > 0 &&
    personas[0]?.level &&
    personas[0]?.position;

  useEffect(() => {
    let isCancelled = false;

    const fetchUserRole = async () => {
      try {
        if (!user) {
          if (!isCancelled) {
            setUserRole(null);
            setCurrentView("employee");
            setLoading(false);
          }
          return;
        }

        // If you stash role in JWT app_metadata, prefer that (no DB call)
        const metaRole = (user.app_metadata as { role?: UserRole })?.role;
        if (metaRole) {
          if (!isCancelled) {
            setUserRole(metaRole);
            setCurrentView(metaRole === "admin" ? "admin" : "employee");
            setLoading(false);
          }
          return;
        }

        // Read-only attempt; no upsert/insert
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        // If table/column missing or RLS blocks, degrade cleanly
        if (error) {
          console.error("[profiles.select] error:", error);
          if (!isCancelled) {
            setUserRole("employee");
            setCurrentView("employee");
            setLoading(false);
          }
          return;
        }

        // No row? Accept default — do NOT create one.
        const role = (data?.role as UserRole) ?? "employee";
        if (!isCancelled) {
          setUserRole(role);
          setCurrentView(role === "admin" ? "admin" : "employee");
          setLoading(false);
        }
      } catch (e: unknown) {
        console.error(
          "[RoleProvider] unexpected:",
          e instanceof Error ? e.message : e
        );
        if (!isCancelled) {
          setUserRole("employee");
          setCurrentView("employee");
          setLoading(false);
        }
      }
    };

    fetchUserRole();
    return () => {
      isCancelled = true;
    };
  }, [user, supabase]);

  // Show welcome modal if user hasn't viewed intro OR doesn't have complete persona data
  useEffect(() => {
    if (
      user &&
      !profileLoading &&
      !personasLoading &&
      (!hasViewedIntro || !hasCompletePersona)
    ) {
      setShowWelcomeModal(true);
    }
  }, [
    user,
    profileLoading,
    personasLoading,
    hasViewedIntro,
    hasCompletePersona,
  ]);

  const switchToEmployee = () => {
    if (userRole === "superadmin") {
      setCurrentView("employee");
    }
  };

  const switchToAdmin = () => {
    if (userRole === "superadmin" || userRole === "admin") {
      setCurrentView("admin");
    }
  };

  const value = {
    userRole,
    loading,
    switchToEmployee,
    switchToAdmin,
    currentView,
    showWelcomeModal,
    setShowWelcomeModal,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
