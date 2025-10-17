import type { Address } from "@coinbase/onchainkit/identity";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import * as chains from "viem/chains";
import { base } from "viem/chains";
import { AGENT_TRANSFER_AMOUNT, BASE_USDC_ADDRESS } from "../lib/constants.js";
import { env } from "../lib/env.js";

const client = createPublicClient({
	chain: base,
	transport: http(`https://base-mainnet.infura.io/v3/${env.INFURA_API_KEY}`),
});

/**
 * Watch for USDC transfers
 * @param address - The address to watch the transfer for
 * @returns
 */
export const watchUSDCTransfer = async ({
	targetAddress,
	senderAddress,
	onSuccess,
}: {
	targetAddress: Address;
	senderAddress: Address;
	onSuccess: ({ txHash }: { txHash: string }) => void;
}) => {
	console.log(
		"watching for USDC transfers to agent address",
		targetAddress,
		"from",
		senderAddress,
	);
	const unwatch = await client.watchContractEvent({
		address: BASE_USDC_ADDRESS as Address,
		abi: erc20Abi,
		eventName: "Transfer",
		args: { to: targetAddress, from: senderAddress },
		onLogs: (logs) => {
			logs.forEach((log) => {
				console.log("log", log);
				if (log.args.value) {
					const amount = formatUnits(BigInt(log.args.value), 6); // USDC decimals
					if (Number.parseFloat(amount) >= Number(AGENT_TRANSFER_AMOUNT)) {
						console.log(
							`✅ Received ${amount} USDC on transaction ${log.transactionHash}!`,
						);
						onSuccess({ txHash: log.transactionHash });
					} else {
						console.log(
							`❌ Received ${amount} USDC, but it's less than ${AGENT_TRANSFER_AMOUNT} USDC on transaction ${log.transactionHash}`,
						);
					}
					unwatch();
				}
			});
		},
	});
};
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
