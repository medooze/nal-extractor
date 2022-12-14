
/**
 * Parse an UUID string into its bits
 * @returns {BigInt}
 */
export function parseUuid(/** @type {string} */ x) {
	if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(x))
		throw Error(`invalid UUID: ${x}`)
	return BigInt('0x' + x.replace(/-/g, ''))
}
