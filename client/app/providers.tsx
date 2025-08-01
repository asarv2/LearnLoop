// app/providers.tsx
"use client";

import { createQueryClient } from "@/utils/react-query/queryClient";
import {
    QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from "react";
import { Theme } from "@radix-ui/themes";
import { ConfigProvider } from 'antd';
import { AuthProvider } from "@/components/auth/AuthProvider";

const ReactQueryClientProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [queryClient] = useState(() => createQueryClient()); // Use a single instance
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV !== 'production' && <ReactQueryDevtools />}
        </QueryClientProvider>
    );
};

export const Providers = ({ children }: { children: React.ReactNode }) => {
    return (
        <ReactQueryClientProvider>
            <AuthProvider>
                <Theme>
                    <ConfigProvider
                        theme={{
                            token: {
                                colorPrimary: '#1890ff',
                            },
                        }}
                    >
                        {children}
                    </ConfigProvider>
                </Theme>
            </AuthProvider>
        </ReactQueryClientProvider>
    );
};
