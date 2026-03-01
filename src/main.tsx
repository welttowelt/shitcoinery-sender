import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StarknetConfig } from "@starknet-react/core";
import { cartridgeConnector, starknetChains, starknetProvider } from "./starknet";
import "./index.css";
import App from "./App";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StarknetConfig
      autoConnect
      chains={starknetChains}
      connectors={[cartridgeConnector]}
      provider={starknetProvider}
    >
      <App />
    </StarknetConfig>
  </StrictMode>,
);
