// utils/logger.ts
"use server";

import { createLog } from "@/utils/mutations/logs/create-log";
import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";

// Server-only PostgreSQL logger, log to console in non production
const isProduction = process.env.NODE_ENV === "production";

// Direct PostgreSQL logging function
async function insertLogToDatabase(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  context: Record<string, unknown>
): Promise<void> {
  try {
    // Try to get current user, but don't fail if not available
    let userId: string | null = null;
    try {
      const supabase = await supabaseServer(cookies());
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch {
      // Ignore auth errors - logs can be created without user context
    }

    // convert context to json
    const contextJson = JSON.stringify(context);
    await createLog({
      level,
      message: message + " " + contextJson,
      user_id: userId,
    });
  } catch (error) {
    throw new Error(`Failed to insert log to database: ${error}`);
  }
}

// Simple async logging functions that store directly to Supabase
export async function logToDatabase(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    await insertLogToDatabase(level, message, context || {});
  } catch (error) {
    throw new Error(`Failed to log to database: ${error}`);
  }
}

// Convenience functions
export async function logInfo(
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  if (!isProduction) {
    console.log(message, context);
  }
  return logToDatabase("info", message, context);
}

export async function logError(
  message: string,
  error?: Error | unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const errorInfo =
    error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;

  if (!isProduction) {
    console.error(message, errorInfo);
  }

  return logToDatabase("error", message, {
    ...context,
    error: errorInfo,
  });
}

export async function logWarn(
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  if (!isProduction) {
    console.warn(message, context);
  }
  return logToDatabase("warn", message, context);
}

export async function logDebug(
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  if (!isProduction) {
    console.debug(message, context);
  }
  return logToDatabase("debug", message, context);
}
