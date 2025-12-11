// apps/frontend/src/app/query-provider.tsx
"use client";

import { useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * 全局 React Query Provider
 * - 负责在客户端创建并提供 QueryClient
 * - Dev 环境下会挂 ReactQueryDevtools
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 后面可以按需要调整默认行为
            // refetchOnWindowFocus: false,
            // retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}