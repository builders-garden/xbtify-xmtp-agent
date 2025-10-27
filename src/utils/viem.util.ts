import { createPublicClient, type Hex, http } from "viem";
import * as chains from "viem/chains";
import { base } from "viem/chains";
import { env } from "../lib/env.js";

const client = createPublicClient({
	chain: base,
	transport: http(`https://base-mainnet.infura.io/v3/${env.INFURA_API_KEY}`),
});

/**
 * Gets the chain object for the given chain id.
 * @param chainId - Chain id of the target EVM chain.
 * @returns Viem's chain object.
 */
export const getChainByName = (chainName: string) => {
	for (const chain of Object.values(chains)) {
		if ("id" in chain) {
			if (chain.name.toLowerCase() === chainName.toLowerCase()) {
				return chain;
			}
		}
	}

	throw new Error(`Chain with name ${chainName} not found`);
};

/**
 * Get the transaction from the given transaction hash
 * @param txHash - The transaction hash to get the transaction for
 * @returns
 */
export const getTransactionReceipt = async (txHash: Hex) => {
	const txReceipt = await client.getTransactionReceipt({
		hash: txHash,
	});
	return txReceipt;
};
