import { Profile } from "@/types";
import { Session, User } from "@supabase/supabase-js";

export type ViewMode = "employee" | "admin" | "superadmin";

export interface ExtendedSession extends Session {
  // View mode emulation state
  emulationMode?: ViewMode;
  emulationTTL?: number;
  fullEmulation?: boolean;
}

export interface EnhancedAuthContextType {
  // Existing Supabase auth
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;

  // New view mode emulation properties
  activeProfile: Profile | null;
  effectiveProfile: Profile | null;
  isEmulating: boolean;
  isProfileLoading: boolean;

  // New view mode emulation methods
  startEmulation: (viewMode: ViewMode) => Promise<boolean>;
  stopEmulation: () => void;
}
