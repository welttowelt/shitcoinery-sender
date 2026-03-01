/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAINNET_RPC_URL?: string;
  readonly VITE_CARTRIDGE_SLOT?: string;
  readonly VITE_CARTRIDGE_NAMESPACE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
