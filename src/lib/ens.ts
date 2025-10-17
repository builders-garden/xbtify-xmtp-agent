import { getAvatar, getName } from "@coinbase/onchainkit/identity";
import { type Address, createPublicClient, getAddress, http } from "viem";
import { base, mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const mainnetClient = createPublicClient({
	chain: mainnet,
	transport: http(),
});

/**
 * Get the ENS name for a given address
 * @param address
 * @returns normalized ENS name or null if not found
 */
export async function getEnsName(address: Address): Promise<string | null> {
	const ensName = await mainnetClient.getEnsName({
		address: getAddress(address),
	});
	if (!ensName) return null;
	return normalize(ensName);
}

/**
 * Get the ENS avatar for a given ENS name
 * @param ensName
 * @returns
 */
export async function getEnsAvatar(ensName: string) {
	const ensAvatar = await mainnetClient.getEnsAvatar({ name: ensName });
	return ensAvatar;
}

/**
 * Get the Base name for a given address
 * @param address
 * @returns normalized Base name or null if not found
 */
export async function getBasename(address: Address): Promise<string | null> {
	const baseName = await getName({ address: getAddress(address), chain: base });
	if (!baseName) return null;
	return normalize(baseName);
}

/**
 * Get the Base avatar for a given Base name
 * @param baseName
 * @returns
 */
export async function getBasenameAvatar(baseName: string) {
	const baseAvatar = await getAvatar({ ensName: baseName, chain: base });
	return baseAvatar;
}
