"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

export function Web3Provider({
  children,
  initialState,
}: {
  children: ReactNode;
  // Hydrated from the cookie on the server. Without it a reload starts with no
  // connection and the wallet appears to disconnect on every refresh.
  initialState?: State;
}) {
  // One client per mount, never one per render -- a fresh QueryClient on every
  // render would throw away the cache and refetch the chain constantly.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Chain reads are cheap but not free, and blocks are ~101s apart.
            staleTime: 15_000,
            retry: 2,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState} reconnectOnMount>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
