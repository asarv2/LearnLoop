// app/providers.tsx
"use client";

import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { createQueryClient } from "@/utils/react-query/queryClient";
import { Theme } from "@radix-ui/themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { useState } from "react";

const ReactQueryClientProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [queryClient] = useState(() => createQueryClient()); // Use a single instance
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* {process.env.NODE_ENV !== "production" && <ReactQueryDevtools />} */}
    </QueryClientProvider>
  );
};

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ReactQueryClientProvider>
      <AuthProvider>
        <WebSocketProviderWrapper>
          <Theme>
            <ConfigProvider
              theme={{
                token: {
                  colorPrimary: "#1890ff",
                },
              }}
            >
              {children}
              <Toaster />
            </ConfigProvider>
          </Theme>
        </WebSocketProviderWrapper>
      </AuthProvider>
    </ReactQueryClientProvider>
  );
};

// Wrapper component to get user ID from AuthProvider and pass it to WebSocketProvider
const WebSocketProviderWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useAuth();
  const profileId = user?.id || undefined;

  return (
    <WebSocketProvider profileId={profileId}>{children}</WebSocketProvider>
  );
};
