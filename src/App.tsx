import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useTransactionReceipt,
} from "@starknet-react/core";
import { CallData, cairo, type Call } from "starknet";
import "./App.css";

type TransferFormState = {
  selectedToken: string;
  tokenAddress: string;
  recipient: string;
  amount: string;
  decimals: string;
};

const STRK_TOKEN_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const SLAY_TOKEN_ADDRESS =
  "0x02Ab526354a39E7f5D272f327FA94e757df3688188d4a92C6Dc3623Ab79894E2";

const TOKENS = [
  { key: "STRK", label: "STRK", address: STRK_TOKEN_ADDRESS },
  { key: "SLAY", label: "SLAY", address: SLAY_TOKEN_ADDRESS },
] as const;

const CUSTOM_TOKEN_KEY = "CUSTOM";

const TRANSFER_FORM_DEFAULTS: TransferFormState = {
  selectedToken: "STRK",
  tokenAddress: STRK_TOKEN_ADDRESS,
  recipient: "",
  amount: "",
  decimals: "18",
};

const HEX_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{1,64}$/;

function shortenAddress(address?: string): string {
  if (!address) return "Not connected";
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function normalizeAddress(value: string): `0x${string}` {
  const candidate = value.trim();
  if (!HEX_ADDRESS_PATTERN.test(candidate)) {
    throw new Error("Address must be a hex value starting with 0x.");
  }
  const normalized = candidate.toLowerCase();
  return normalized as `0x${string}`;
}

function parseAmountToUnits(amountInput: string, decimalsInput: string): bigint {
  const amount = amountInput.trim();
  if (!amount) {
    throw new Error("Amount is required.");
  }
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error("Amount must be a valid number.");
  }

  if (!/^\d+$/.test(decimalsInput.trim())) {
    throw new Error("Decimals must be a whole number.");
  }
  const decimals = Number(decimalsInput);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new Error("Decimals must be between 0 and 30.");
  }

  const [wholePart, fractionPart = ""] = amount.split(".");
  if (fractionPart.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places.`);
  }

  const base = 10n ** BigInt(decimals);
  const whole = BigInt(wholePart);
  const fraction = fractionPart
    ? BigInt(fractionPart.padEnd(decimals, "0"))
    : 0n;

  return whole * base + fraction;
}

function extractTxHash(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;

  if (typeof record.transaction_hash === "string") {
    return record.transaction_hash;
  }

  if (typeof record.transactionHash === "string") {
    return record.transactionHash;
  }

  return null;
}

function formatError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const fromCause = formatError((error as { cause?: unknown }).cause);
    if (fromCause !== "Unexpected error.") {
      return `${error.message}: ${fromCause}`;
    }
    return error.message;
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const candidateKeys = [
      "shortMessage",
      "message",
      "reason",
      "details",
      "error",
      "data",
      "cause",
    ];
    for (const key of candidateKeys) {
      const candidate = formatError(record[key]);
      if (candidate !== "Unexpected error.") return candidate;
    }
  }
  return "Unexpected error.";
}

function extractReceiptStatus(receipt: unknown): string {
  if (!receipt || typeof receipt !== "object") {
    return "Pending";
  }

  const record = receipt as Record<string, unknown>;
  const executionStatus =
    typeof record.execution_status === "string" ? record.execution_status : "";
  const finalityStatus =
    typeof record.finality_status === "string" ? record.finality_status : "";

  const composed = [executionStatus, finalityStatus].filter(Boolean).join(" / ");
  return composed || "Pending";
}

function App() {
  const [form, setForm] = useState<TransferFormState>(TRANSFER_FORM_DEFAULTS);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { address, status, isConnected, connector } = useAccount();
  const {
    connect,
    connectors,
    isPending: isConnectPending,
    error: connectError,
  } = useConnect();
  const { disconnect, isPending: isDisconnectPending } = useDisconnect();
  const {
    sendAsync,
    isPending: isTransferPending,
    error: sendError,
    reset: resetSendState,
  } = useSendTransaction({});

  const receipt = useTransactionReceipt({
    hash: transactionHash ?? undefined,
    watch: true,
    enabled: Boolean(transactionHash),
  });

  const tokenAddressToKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const token of TOKENS) {
      map.set(token.address.toLowerCase(), token.key);
    }
    return map;
  }, []);

  const controllerConnector = useMemo(
    () => connectors.find((current) => current.id === "controller"),
    [connectors],
  );

  const unitsPreview = useMemo(() => {
    if (!form.amount.trim() || !form.decimals.trim()) return "0";
    try {
      return parseAmountToUnits(form.amount, form.decimals).toString();
    } catch {
      return "Invalid amount";
    }
  }, [form.amount, form.decimals]);

  const combinedError =
    validationError ?? (sendError ? formatError(sendError) : null);

  const onFieldChange =
    (field: keyof TransferFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (field === "tokenAddress") {
        const normalizedKey = tokenAddressToKey.get(value.trim().toLowerCase());
        setForm((current) => ({
          ...current,
          tokenAddress: value,
          selectedToken: normalizedKey ?? CUSTOM_TOKEN_KEY,
        }));
        return;
      }

      setForm((current) => ({ ...current, [field]: value }));
    };

  const onTokenChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedToken = event.target.value;
    if (selectedToken === CUSTOM_TOKEN_KEY) {
      setForm((current) => ({
        ...current,
        selectedToken: CUSTOM_TOKEN_KEY,
      }));
      return;
    }

    const selected = TOKENS.find((token) => token.key === selectedToken);
    if (!selected) return;

    setForm((current) => ({
      ...current,
      selectedToken: selected.key,
      tokenAddress: selected.address,
    }));
  };

  const onConnect = () => {
    setValidationError(null);
    setTransactionHash(null);

    const selectedConnector = controllerConnector ?? connectors[0];
    if (!selectedConnector) {
      setValidationError("Cartridge connector is unavailable.");
      return;
    }

    connect({ connector: selectedConnector });
  };

  const onDisconnect = () => {
    disconnect();
    setTransactionHash(null);
    setValidationError(null);
  };

  const onSubmitTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetSendState();
    setValidationError(null);
    setTransactionHash(null);

    if (!isConnected) {
      setValidationError("Connect your Cartridge account first.");
      return;
    }

    try {
      const tokenAddress = normalizeAddress(form.tokenAddress);
      const recipientAddress = normalizeAddress(form.recipient);
      const amount = parseAmountToUnits(form.amount, form.decimals);

      if (amount <= 0n) {
        throw new Error("Amount must be greater than zero.");
      }

      const amountU256 = cairo.uint256(amount);
      const transferCall: Call = {
        contractAddress: tokenAddress,
        entrypoint: "transfer",
        // Positional calldata avoids ABI parameter name mismatches across tokens.
        calldata: CallData.compile([
          recipientAddress,
          amountU256.low,
          amountU256.high,
        ]),
      };

      const result = await sendAsync([transferCall]);
      const txHash = extractTxHash(result);

      if (!txHash) {
        throw new Error("Transfer sent, but no transaction hash was returned.");
      }

      setTransactionHash(txHash);
    } catch (error) {
      setValidationError(formatError(error));
    }
  };

  return (
    <main className="app-shell">
      <section className="app-panel">
        <header className="app-header">
          <p className="eyebrow">Night City Transfer Desk</p>
          <h1 className="title-glitch" data-text="Shitcoinery Sender">
            Shitcoinery Sender
          </h1>
          <p className="subtitle">
            High-tech, low-life token sender for Starknet mainnet. Connect your
            Cartridge wallet and move STRK, SLAY, or custom assets.
          </p>
          <div className="signal-row">
            <span className="signal-tag">Mainnet</span>
            <span className="signal-tag signal-tag-cyan">Controller Wallet</span>
          </div>
        </header>

        <section className="status-card">
          <div className="status-row">
            <span className="status-label">Connection</span>
            <span className={`badge ${isConnected ? "online" : "offline"}`}>
              {status}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">Wallet</span>
            <span className="mono">{shortenAddress(address)}</span>
          </div>
          <div className="status-row">
            <span className="status-label">Connector</span>
            <span>{connector?.name ?? "Cartridge"}</span>
          </div>
          <div className="status-actions">
            {!isConnected ? (
              <button
                className="button button-primary"
                onClick={onConnect}
                type="button"
                disabled={isConnectPending}
              >
                {isConnectPending ? "Connecting..." : "Connect Cartridge"}
              </button>
            ) : (
              <button
                className="button button-secondary"
                onClick={onDisconnect}
                type="button"
                disabled={isDisconnectPending}
              >
                {isDisconnectPending ? "Disconnecting..." : "Disconnect"}
              </button>
            )}
          </div>
          {connectError ? (
            <p className="hint error">Connect error: {formatError(connectError)}</p>
          ) : null}
        </section>

        <form className="transfer-form" onSubmit={onSubmitTransfer}>
          <label>
            Token
            <select value={form.selectedToken} onChange={onTokenChange}>
              {TOKENS.map((token) => (
                <option key={token.key} value={token.key}>
                  {token.label}
                </option>
              ))}
              <option value={CUSTOM_TOKEN_KEY}>Custom</option>
            </select>
          </label>
          <label>
            Token Address
            <input
              value={form.tokenAddress}
              onChange={onFieldChange("tokenAddress")}
              placeholder="0x..."
              autoComplete="off"
              required
            />
          </label>
          <label>
            Recipient Address
            <input
              value={form.recipient}
              onChange={onFieldChange("recipient")}
              placeholder="0x..."
              autoComplete="off"
              required
            />
          </label>
          <div className="split">
            <label>
              Amount
              <input
                value={form.amount}
                onChange={onFieldChange("amount")}
                placeholder="0.0"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Decimals
              <input
                value={form.decimals}
                onChange={onFieldChange("decimals")}
                placeholder="18"
                autoComplete="off"
                required
              />
            </label>
          </div>

          <p className="hint">
            Smallest-unit preview: <span className="mono">{unitsPreview}</span>
          </p>

          {combinedError ? <p className="hint error">{combinedError}</p> : null}

          <button
            className="button button-primary full"
            disabled={!isConnected || isTransferPending}
            type="submit"
          >
            {isTransferPending ? "Sending..." : "Send Transfer"}
          </button>
        </form>

        {transactionHash ? (
          <section className="tx-card">
            <h2>Last Broadcast</h2>
            <p className="mono wrap">{transactionHash}</p>
            <p className="hint">
              Status:{" "}
              {receipt.isFetching
                ? "Refreshing..."
                : extractReceiptStatus(receipt.data)}
            </p>
            <a
              href={`https://starkscan.co/tx/${transactionHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Vladscan
            </a>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default App;
