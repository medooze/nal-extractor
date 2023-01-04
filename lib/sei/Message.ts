import BitReader from "../BitReader.js"

/** Raw SEI message, as a [type, payload] tuple. See {@link sei/MessageType.SEIMessageType}. */
export type RawSEIMessage = [ number, Uint8Array ]

/**
 * Parse an (already unescaped) SEI RBSP into raw messages.
 * Note: subarrays of rbsp are returned
 */
export function parseSEI(rbsp: Uint8Array): RawSEIMessage[] {
	// de-encapsulate SODB from within RBSP. since SEI SODB ends up in a byte-aligned
	// position and doesn't have zero words, we just need to strip the trailing bits
	if (rbsp.length === 0)
		return []
	if (rbsp[rbsp.length - 1] !== 0x80)
		throw TypeError('invalid SEI RBSP -- not byte aligned')
	const length = rbsp.length - 1

	// parse SEI messages until left without data
	const result: RawSEIMessage[] = []
	let position = 0
	while (position < length) {
		// parse payload type
		let payloadType = 0
		while (true) {
			if (!(position < length))
				throw Error('EOF while reading payload type')
			const byte = rbsp[position++]
			payloadType += byte
			if (byte !== 0xFF) break
		}
		// parse payload size
		let payloadSize = 0
		while (true) {
			if (!(position < length))
				throw Error('EOF while reading payload type')
			const byte = rbsp[position++]
			payloadSize += byte
			if (byte !== 0xFF) break
		}
		// consume message payload & add to list
		if (position + payloadSize > length)
			throw TypeError('EOF while reading payload')
		result.push([ payloadType, rbsp.subarray(position, position + payloadSize) ])
		position += payloadSize
	}
	return result
}

export function validateSEITrailing(reader: BitReader): void {
	if (!(reader.offset < reader.length))
		return // already byte aligned, nothing to trim
	if (!(reader.length - reader.offset < 8))
		throw TypeError(`unexpected trailing data found: ${reader.length - reader.offset} bits`)
	if (!(reader.read1() && !reader.read(reader.length - reader.offset)))
		throw TypeError('unexpected alignment trailing bits')
}
