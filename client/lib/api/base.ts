// lib/api/base.ts
export function getApiBase(): string {
    // --- Browser branch --------------------------------------------------
    if (typeof window !== "undefined") {
      // In prod this should be "", but during local dev you *can*
      // override it with NEXT_PUBLIC_API_BASE=http://localhost:8000
      return process.env["NEXT_PUBLIC_API_BASE"] ?? "";
    }
  
    // --- Server-side (Node in any environment) ---------------------------
    // In prod this is the Docker service name; in local dev you
    // run FastAPI on the host, so localhost is correct.
    return (
      process.env["INTERNAL_API_BASE"] ??
      (process.env["NODE_ENV"] === "development"
        ? "http://localhost:8000"
        : "http://server:8000")
    );
  }