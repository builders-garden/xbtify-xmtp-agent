# XBTify XMTP Agent 🦊

XBTify is an XMTP-powered agent that automates Farcaster-style interactions. It runs an Express server and an XMTP Agent that:

- Listens to DMs and group conversations on XMTP
- Welcomes new DMs/groups and sends inline action menus
- Watches for onchain USDC payments (gasless through Coinbase CDP Paymaster) and creates the XBT ai twin when the payment is finalized
- Exposes an HTTP endpoint to programmatically DM users `fid`

Built on `@xmtp/agent-sdk`, with middleware for inline actions and reactions, and a Postgres-backed Drizzle ORM database.

## What it does

- Responds to XMTP messages using AI
  - Skips messages from self and reactions
  - Replies to direct replies or when trigger keywords/mentions are detected
  - Sends contextual help and action buttons when appropriate
- Handles DMs and Groups
  - On first DM/group message, sends a welcome message and action menu
  - Tracks group metadata changes and membership add/remove events
- Inline actions and reactions
  - Registers action handlers and renders interactive buttons (XIP-67)
  - Shows a “thinking” emoji while the agent processes a request
- Onchain payment flow
  - When a payment is requested, watches for USDC transfers to the agent
  - Acknowledges payment and continues the flow once detected
- HTTP API to send messages
  - `POST /api/send/message` to DM a user by Farcaster `fid`

## Setup

1. Clone the repository:

```bash
git clone <repository-url> xbtify-xmtp-agent
cd xbtify-xmtp-agent
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables, copy and fill all the variables `.env.example` to `.env`

```bash
cp .env.example .env
vi .env
```

4. Generate wallet keys and encryption key:

```bash
pnpm run gen:keys
```

5. Build and run the server:

```bash
pnpm run build
pnpm run start
```

## Development

Run the development server

```bash
pnpm run dev
```

## Environment Variables

The agent reads configuration from environment variables (validated via Zod). Key variables:

- `APP_URL`: Public base URL of this service
- `PORT` (default `3001`)
- `NODE_ENV` (`development` | `production`, default `production`)
- `API_KEY`: API key for securing HTTP endpoints
- `BACKEND_URL`, `BACKEND_API_KEY`: Upstream backend integration
- `XMTP_ENV` (`dev` | `local` | `production`, default `production`)
- `XMTP_WALLET_KEY`: Hex private key for the XMTP agent
- `XMTP_DB_ENCRYPTION_KEY` (optional): Encryption key for the local XMTP DB
- `RAILWAY_VOLUME_MOUNT_PATH` (default `.`): Base path for XMTP DB files
- `DATABASE_URL`: Postgres connection string (Drizzle ORM)
- `NEYNAR_API_KEY`: Neynar API key
- `OPENAI_API_KEY`: OpenAI API key used by the AI module
- `COINBASE_CDP_CLIENT_API_KEY`: Coinbase CDP key
- `PIMLICO_API_KEY`: Pimlico key
- `INFURA_API_KEY`: Infura key for chain access

Notes:
- XMTP database files are created per inbox at `${RAILWAY_VOLUME_MOUNT_PATH}/${XMTP_ENV}-XXXXXXXX.db3`.
- When `NODE_ENV=development`, API key auth is bypassed for convenience.

## Scripts

- `pnpm build`: TypeScript build to `dist`
- `pnpm start`: Run compiled server from `dist`
- `pnpm dev`: Run with live-reload via `tsx`
- `pnpm gen:keys`: Build then generate a wallet and encryption key helper output
- Drizzle:
  - `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:pull`, `pnpm db:push`, `pnpm db:studio`

## HTTP API

Base path: `/api/send`

### POST /api/send/message

Send a direct message to a user by Farcaster FID. Requires `x-api-key` header when not in development.

Request headers:

```http
x-api-key: <API_KEY>
content-type: application/json
```

Request body:

```json
{
  "message": "hello from xbtify",
  "userFid": 12345
}
```

Response:

```json
{ "status": "ok" }
```

Example cURL:

```bash
curl -X POST "$APP_URL/api/send/message" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d '{"message":"hello from xbtify","userFid":12345}'
```

## Runtime behavior

- The Express server exposes health (`GET /`) and the messaging route.
- On boot, the XMTP Agent is created via environment variables with codecs for replies, reactions, group updates, wallet send calls, custom actions, intents, and remote attachments.
- The agent registers inline-actions and an eyes-reaction middleware.
- On first group event, it persists the group and sends a welcome message plus action menu.
- On messages, it extracts content, checks triggers, generates an AI answer, optionally monitors USDC transfers, and replies.

## Technical Requirements

- Node.js (v20 or higher)
- pnpm (as package manager)
- Postgres
- Ethereum Private Key (for XMTP agent)
- OpenAI API Key (for AI processing)
- Neynar API Key (for neynar webhook events)
- Coinbase CDP API Key (for Coinbase CDP paymaster)
- Pimlico API Key (for Pimlico paymaster)

