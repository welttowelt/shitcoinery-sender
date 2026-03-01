import { ControllerConnector } from "@cartridge/connector";
import { mainnet } from "@starknet-react/chains";
import { jsonRpcProvider } from "@starknet-react/core";
import { constants } from "starknet";

const mainnetRpcUrl =
  import.meta.env.VITE_MAINNET_RPC_URL?.trim() || "https://rpc.starknet.lava.build";

const cartridgeSlot = import.meta.env.VITE_CARTRIDGE_SLOT?.trim();
const cartridgeNamespace = import.meta.env.VITE_CARTRIDGE_NAMESPACE?.trim();

export const starknetChains = [mainnet];

export const starknetProvider = jsonRpcProvider({
  rpc: () => ({ nodeUrl: mainnetRpcUrl }),
});

export const cartridgeConnector = new ControllerConnector({
  defaultChainId: constants.StarknetChainId.SN_MAIN,
  chains: [{ rpcUrl: mainnetRpcUrl }],
  lazyload: true,
  namespace: cartridgeNamespace || undefined,
  slot: cartridgeSlot || undefined,
});
