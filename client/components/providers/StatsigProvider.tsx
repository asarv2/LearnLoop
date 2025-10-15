"use client";

import { StatsigProvider, useClientAsyncInit } from "@statsig/react-bindings";
import { StatsigSessionReplayPlugin } from "@statsig/session-replay";
import { StatsigAutoCapturePlugin } from "@statsig/web-analytics";
import React from "react";

interface StatsigWrapperProps {
  children: React.ReactNode;
}

const StatsigWrapper: React.FC<StatsigWrapperProps> = ({ children }) => {
  const clientKey = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY!;

  const { client } = useClientAsyncInit(
    clientKey,
    {
      userID: "anonymous", // Will be updated when user logs in
      custom: {
        environment: process.env.NODE_ENV || "development",
        isAuthenticated: false,
      },
    },
    {
      plugins: [
        new StatsigAutoCapturePlugin(),
        new StatsigSessionReplayPlugin(),
      ],
    }
  );

  return (
    <StatsigProvider
      client={client}
    >
      {children}
    </StatsigProvider>
  );
};

export default StatsigWrapper;
