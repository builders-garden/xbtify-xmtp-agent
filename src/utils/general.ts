import { fromString } from "uint8arrays";

/**
 * Get encryption key from string
 * @param encryptionKey - The encryption key string
 * @returns The encryption key
 */
export const getEncryptionKeyFromString = (encryptionKey: string) => {
	return fromString(encryptionKey);
};

/**
 * Format the avatar src for imagedelivery.net images to reasonable avatar sizes
 *
 * @docs https://developers.cloudflare.com/images/transform-images/transform-via-url/#options
 *
 * @param avatarSrc - The src of the avatar
 * @returns The formatted avatar src
 */
export const formatAvatarSrc = (src: string) => {
	let avatarSrc = src;
	if (avatarSrc.startsWith("https://imagedelivery.net")) {
		const defaultAvatar = "/anim=false,fit=contain,f=auto,w=512";
		if (avatarSrc.endsWith("/rectcrop3")) {
			avatarSrc = avatarSrc.replace("/rectcrop3", defaultAvatar);
		} else if (avatarSrc.endsWith("/original")) {
			avatarSrc = avatarSrc.replace("/original", defaultAvatar);
		} else if (avatarSrc.endsWith("/public")) {
			avatarSrc = avatarSrc.replace("/public", defaultAvatar);
		}
	}
	return avatarSrc;
};
