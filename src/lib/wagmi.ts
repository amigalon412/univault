import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { injected } from "wagmi/connectors";
import { bnbChain } from "@/lib/chain";

/**
 * Injected wallets only. WalletConnect would mean shipping a project id and
 * routing every session through a third-party relay, which is not a trade we
 * need to make for a chain whose users already have a browser wallet.
 */
export const wagmiConfig = createConfig({
  chains: [bnbChain],
  connectors: [injected()],
  transports: {
    [bnbChain.id]: http(),
  },
  // The app is server-rendered, so connection state has to survive hydration.
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
