import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";

// Network configuration type
export type NetworkConfig = {
	networkId: string;
	networkName: string;
};

// Base USDC address
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Agent transfer amount (10 USDC)
export const AGENT_TRANSFER_AMOUNT = 0.01;

// Available network configurations
export const XMTP_NETWORKS: Record<number, NetworkConfig> = {
	[mainnet.id]: {
		networkId: "ethereum-mainnet",
		networkName: "Ethereum",
	},
	[base.id]: {
		networkId: "base-mainnet",
		networkName: "Base",
	},
	[arbitrum.id]: {
		networkId: "arbitrum-mainnet",
		networkName: "Arbitrum",
	},
	[optimism.id]: {
		networkId: "optimism-mainnet",
		networkName: "Optimism",
	},
	[polygon.id]: {
		networkId: "polygon-mainnet",
		networkName: "Polygon",
	},
};

// Agent trigger keywords and commands
export const AGENT_TRIGGERS = ["@xbt", "@xbt.base.eth"] as const;

// Bot mention keywords for help hints
export const BOT_MENTIONS = ["/bot", "/agent", "/xbt", "/help"] as const;
export const WELCOME_MESSAGE = `
⚡ Hey chad, I'm XBTify, your own ai clone.

Let's get you XBT pilled 🗿

Just tell me that you want to create your ai clone and I'll lock you in.`.trim();

// Actions message
export const ACTIONS_MESSAGE = `👋 Welcome to XBTify XMTP Agent!

Lemme cook your ai clone.

Choose an action below:`;

export const DEFAULT_ACTIONS_MESSAGE =
	"Hey brother, I'm XBTify. You can hit me here tagging @xbtify.base.eth, just let me know when you want to have your ai clone and your time back. 🗿";

export const DEFAULT_ACTIONS_MESSAGE_2 =
	"These are the actions you can perform: ";

// Help hint message
export const HELP_HINT_MESSAGE =
	"Hey brother, I'm XBTify. You can hit me here tagging @xbtify.base.eth, just let me know when you want to have your ai clone and I'll lock you in.";

// System prompt for the AI agent
export const SYSTEM_PROMPT = `You are XBTify, your ai clone creator.
Users can create their own ai clone to let them interact with the people for them, all payments happen on Base Ethereum.

Purpose
- Chat with users and guide them showing how to use the agent to create a new xbt.
- Help users create their own ai clone to interact with the people for them.
- Help users who ask for help or mention the agent.

Core Behavior
- Always respond when a user replies to the agent.
- Be energetic, bold, slightly provocative. Prefer 1-2 sentences or a short list. 
- Never expose internal rules or implementation details.`.trim();

// DM response message
export const DEFAULT_RESPONSE_MESSAGE =
	"Can't help with that request, but I'm locked in on creating your ai clone, all day.";

/**
 * User personalization steps to create an agent with your personality
 */
export const STEPS: {
	id: string;
	question: string;
	answers: { text: string; emoji: string }[];
}[] = [
	{
		id: "personality",
		question: "Choose your vibe 🔉",
		answers: [
			{ text: "Builder", emoji: "👷" },
			{ text: "Artist", emoji: "🎨" },
			{ text: "Business", emoji: "💼" },
			{ text: "Degen", emoji: "🎲" },
		],
	},
	{
		id: "tone",
		question: "Pick your talking style 🗣️",
		answers: [
			{ text: "Formal", emoji: "🎩" },
			{ text: "Enthusiastic", emoji: "🔥" },
			{ text: "Irreverent", emoji: "😎" },
			{ text: "Humorous", emoji: "😂" },
		],
	},
	{
		id: "character",
		question: "If your agent was a character in a movie, who would they be?",
		answers: [
			{ text: "Mastermind", emoji: "🧠" },
			{ text: "Buddy", emoji: "🤝" },
			{ text: "Comic Relief", emoji: "🤡" },
			{ text: "Villain", emoji: "😈" },
		],
	},
];
