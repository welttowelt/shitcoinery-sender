# ScrollSage Cartridge Web Tool

A small web app that lets anyone:

- connect their own Cartridge account
- send ERC-20 token transfers on Starknet mainnet
- track transaction status and open the tx in Starkscan

## Stack

- React + TypeScript + Vite
- `@starknet-react/core`
- `@cartridge/connector`
- `starknet`

## Run Locally

```bash
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

## Environment Variables

Create `.env` from `.env.example`.

```bash
cp .env.example .env
```

- `VITE_MAINNET_RPC_URL`: optional Starknet mainnet RPC URL
- `VITE_CARTRIDGE_SLOT`: optional Cartridge slot project name
- `VITE_CARTRIDGE_NAMESPACE`: optional namespace for Cartridge profile features

If omitted, the app uses `https://rpc.starknet.lava.build`.

## Build

```bash
npm run build
npm run preview
```

## Notes

- This tool sends transactions from the user wallet only.
- No private keys are stored in the app.
- The app validates basic address/amount input before requesting wallet approval.
