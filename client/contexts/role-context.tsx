"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import type { Database } from "@/database.types";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import React, { createContext, useContext, useEffect, useState } from "react";

type UserRole = Database["public"]["Enums"]["user_role"];

interface RoleContextType {
  userRole: UserRole | null;
  loading: boolean;
  switchToEmployee: () => void;
  switchToAdmin: () => void;
  currentView: "employee" | "admin";
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

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        setLoading(false);
        return;
      }

      try {
        // First try to get profile by user ID
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching user role:", error);
          // Check if it's a column doesn't exist error
          if (
            error.message?.includes("column") &&
            error.message?.includes("does not exist")
          ) {
            console.log(
              "Role column doesn't exist yet, defaulting to employee"
            );
            setUserRole("employee");
            setCurrentView("employee");
          } else {
            setUserRole("employee"); // Default to employee on error
            setCurrentView("employee");
          }
        } else if (profile) {
          // Handle case where role column might not exist yet
          const role = profile.role || "employee";
          setUserRole(role);
          // Set initial view based on role
          if (role === "superadmin") {
            setCurrentView("employee"); // Superadmin starts in employee view so they can see the switch button
          } else if (role === "admin") {
            setCurrentView("admin");
          } else {
            setCurrentView("employee");
          }
        } else {
          // No profile found, create one with employee role
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              name: user.user_metadata?.full_name || user.email || "User",
              role: "employee",
            })
            .select()
            .single();

          if (createError) {
            console.error("Error creating profile:", createError);
            setUserRole("employee");
            setCurrentView("employee");
          } else {
            setUserRole(newProfile.role || "employee");
            setCurrentView("employee");
          }
        }
      } catch (error) {
        console.error("Unexpected error fetching user role:", error);
        setUserRole("employee");
        setCurrentView("employee");
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user, supabase]);

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
