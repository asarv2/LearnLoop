// app/providers.tsx
"use client";

import { createQueryClient } from "@/utils/react-query/queryClient";
import {
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { Theme } from "@radix-ui/themes";

const ReactQueryClientProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [queryClient] = useState(() => createQueryClient()); // Use a single instance
    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <ReactQueryClientProvider>
                <Theme>{children}</Theme>
            </ReactQueryClientProvider>
        </QueryClientProvider>
    );
}
