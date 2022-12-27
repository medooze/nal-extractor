/**
 * Parse SEI unregistered user data message
 */
export function parseUserDataUnregistered(seiPayload: Uint8Array) {
	// parse UUID
	if (seiPayload.length < 16)
		throw TypeError('EOF when reading UUID')
	const dv = new DataView(seiPayload.buffer, seiPayload.byteOffset)
	const uuid = dv.getBigUint64(0) << 64n | dv.getBigUint64(8)
	// we know this particular SEI message is byte aligned, so nothing to trim. rest is payload
	return { uuid, data: seiPayload.subarray(16) }
}
