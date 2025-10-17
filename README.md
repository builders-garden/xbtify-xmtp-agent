# XBTify XMTP Agent 🦊

XBTify is your ai clone that let u interact on farcaster automatically.

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

5. Run the server:

```bash
pnpm run start
```

## Development

Run the development server

```bash
pnpm run dev
```

## Technical Requirements

- Node.js (v20 or higher)
- pnpm (as package manager)
- Postgres
- Ethereum Private Key (for XMTP agent)
- OpenAI API Key (for AI processing)
- Neynar API Key (for neynar webhook events)
- Coinbase CDP API Key (for Coinbase CDP paymaster)
- Pimlico API Key (for Pimlico paymaster)

