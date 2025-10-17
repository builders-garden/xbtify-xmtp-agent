import { type Address, encodeFunctionData, erc20Abi, toHex } from "viem";
import { base } from "viem/chains";
import { XMTP_NETWORKS } from "../lib/constants.js";
import { env } from "../lib/env.js";

/**
 * Transfer ERC20 token
 * @param from - The address of the sender
 * @param to - The address of the recipient
 * @param chainId - The chain identifier
 * @param tokenAddress - The address of the token to transfer
 * @param tokenSymbol - The symbol of the token
 * @param tokenDecimals - The decimals of the token
 * @param amount - The amount of the token to transfer
 * @param amountInDecimals - The amount of the token to transfer in base units
 * @returns The calls for the transfer
 */
export function transferERC20(data: {
	from: Address; // sender address
	to: Address; // destination address (agent address)
	chainId: number;
	tokenAddress: Address;
	tokenSymbol: string;
	tokenDecimals: number;
	amount: number; // amount in token base units to sell
	amountInDecimals: bigint; // amount in token base units to sell
}) {
	const network = XMTP_NETWORKS[data.chainId];
	if (!network) {
		console.error(`❌ Unsupported chain id: ${data.chainId}`);
		throw new Error(`Unsupported chain id: ${data.chainId}`);
	}

	// encode transfer function data for the destination address with the correct amount
	const transferMethodData = encodeFunctionData({
		abi: erc20Abi,
		functionName: "transfer",
		args: [data.to, data.amountInDecimals],
	});

	const coinbasePaymasterUrl = `https://api.developer.coinbase.com/rpc/v1/base/${env.COINBASE_CDP_CLIENT_API_KEY}`;
	const pimlicoPaymasterUrl = `https://api.pimlico.io/v2/${data.chainId}/rpc?apikey=${env.PIMLICO_API_KEY}`;
	// if using base, use coinbase paymaster, otherwise use pimlico paymaster
	const paymasterUrl =
		data.chainId === base.id ? coinbasePaymasterUrl : pimlicoPaymasterUrl;

	// if using base, use coinbase paymaster, otherwise use pimlico paymaster
	return {
		version: "1.0",
		from: data.from,
		chainId: toHex(base.id),
		capabilities: {
			paymasterService: {
				url: paymasterUrl,
			},
		},
		calls: [
			{
				to: data.tokenAddress,
				data: transferMethodData,
				metadata: {
					description: `Transfer ${data.amount} ${data.tokenSymbol} on ${network.networkName}`,
					transactionType: "transfer",
					currency: data.tokenSymbol,
					amount: data.amount.toString(),
					decimals: data.tokenDecimals.toString(),
					networkId: network.networkId,
					hostname: new URL(env.APP_URL).hostname,
					faviconUrl:
						"https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet",
					title: "XBTify Agent",
				},
			},
		],
	};
}
