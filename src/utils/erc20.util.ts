import {
	type Address,
	createPublicClient,
	erc20Abi,
	formatUnits,
	http,
} from "viem";
import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { BASE_USDC_ADDRESS } from "../lib/constants.js";

/**
 * Get the estimated gas fee for a given chain
 * @param chainId - The chain identifier
 * @returns The estimated gas fee for the given chain
 */
export const getEstimatedGasFee = async ({
	chainId,
}: {
	chainId: number;
}): Promise<{ maxFeePerGas: string; maxPriorityFeePerGas: string }> => {
	const chain = getChain(chainId);
	const publicClient = createPublicClient({
		chain,
		transport: http(),
	});

	const gas = await publicClient.estimateFeesPerGas();
	return {
		maxFeePerGas: gas.maxFeePerGas.toString(),
		maxPriorityFeePerGas: gas.maxPriorityFeePerGas.toString(),
	};
};

/**
 * Get the chain for a given chain id
 * @param chainId
 * @returns The chain for the given chain id
 */
function getChain(chainId: number) {
	switch (chainId) {
		case mainnet.id:
			return mainnet;
		case base.id:
			return base;
		case arbitrum.id:
			return arbitrum;
		case optimism.id:
			return optimism;
		case polygon.id:
			return polygon;
		default:
			throw new Error(`Unsupported chain id: ${chainId}`);
	}
}

/**
 * Get ERC20 balance for a given address
 * @param sellTokenAddress - The address of the ERC20 token to sell
 * @param buyTokenAddress - The address of the ERC20 token to buy
 * @param tokenDecimals - The number of decimals of the ERC20 token
 * @param address - The address to get the balance of
 * @returns The balance of the ERC20 token
 */
export async function getTokenInfo({
	sellTokenAddress,
	buyTokenAddress,
	chainId,
}: {
	sellTokenAddress: Address;
	buyTokenAddress: Address;
	chainId: number;
}): Promise<{
	tokenDecimals: number;
	sellSymbol: string;
	buySymbol: string;
}> {
	const chain = getChain(chainId);
	const publicClient = createPublicClient({
		chain,
		transport: http(),
	});
	const wagmiContract = {
		address: sellTokenAddress,
		abi: erc20Abi,
	} as const;
	// Similar to readContract but batches multiple calls https://viem.sh/docs/contract/multicall
	const [tokenDecimals, sellSymbol, buySymbol] = await publicClient.multicall({
		contracts: [
			{
				...wagmiContract,
				functionName: "decimals",
			},
			{
				...wagmiContract,
				functionName: "symbol",
			},
			{
				abi: erc20Abi,
				address: buyTokenAddress,
				functionName: "symbol",
			},
		],
	});
	if (!tokenDecimals.result || !sellSymbol.result || !buySymbol.result) {
		console.error("Unable to get token decimals, sell symbol, or buy symbol");
		throw new Error("Unable to get token decimals, sell symbol, or buy symbol");
	}

	return {
		tokenDecimals: tokenDecimals.result,
		sellSymbol: sellSymbol.result,
		buySymbol: buySymbol.result,
	};
}

/**
 * Get Base USDC balance for a given address
 * @param address - The address to get the balance of
 * @returns The balance of the USDC token
 */
export async function getBaseUsdcBalance({
	address,
}: {
	address: Address;
}): Promise<{
	balanceRaw: string;
	balance: string;
}> {
	const publicClient = createPublicClient({
		chain: base,
		transport: http(),
	});

	// Similar to readContract but batches multiple calls https://viem.sh/docs/contract/multicall
	const balance = await publicClient.readContract({
		address: BASE_USDC_ADDRESS,
		abi: erc20Abi,
		functionName: "balanceOf",
		args: [address],
	});
	if (!balance) {
		console.error("Unable to get balance");
		throw new Error("Unable to get balance");
	}

	return {
		balanceRaw: balance.toString(),
		balance: formatUnits(balance, 6),
	};
}

/**
 * Get the balance of the ETH on a given chain
 * @param address - The address to get the balance of
 * @param chainId - The chain identifier
 * @returns
 */
export async function getEthBalance({
	address,
	chainId,
}: {
	address: Address;
	chainId: number;
}): Promise<{ balanceRaw: string; balance: string }> {
	const chain = getChain(chainId);
	const publicClient = createPublicClient({
		chain,
		transport: http(),
	});
	const balance = await publicClient.getBalance({
		address: address,
	});
	return {
		balanceRaw: balance.toString(),
		balance: formatUnits(balance, 18),
	};
}
