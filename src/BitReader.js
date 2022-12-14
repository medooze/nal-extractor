
// CAUTION: returned in signed form (for n == 32, result is -1 not 0xFFFFFFFF)
const mask = (/** @type {number} */ n) => ~((~0) << n)

/** MSB-first bit reader */
export default class BitReader {
	constructor(/** @type {Uint8Array} */ data, /** @type {number} */ offset = 0, /** @type {number} */ length = data.length * 8 - offset) {
		if (!(offset === (offset >>> 0) && length === (length >>> 0) && offset <= length && length <= data.length * 8))
			throw new TypeError(`invalid offset / length`)
		this.data = data
		this.offset = offset
		this.length = length
	}

	read1() {
		if (!(this.offset < this.length))
			throw new Error('unexpected EOF')
		const offset = this.offset++
		return Boolean(this.data[offset >>> 3] >> ((~offset) & 0b111))
	}

	read(/** @type {number} */ nBits) {
		if (!(nBits === (nBits >>> 0) && nBits <= 32))
			throw TypeError(`invalid bit number ${nBits}`)
		if (!(this.offset + nBits <= this.length))
			throw Error(`unexpected EOF: expected ${nBits}, got ${this.length - this.offset}`)

		let remaining = nBits
		let pos = this.offset >>> 3
		let result = 0

		// take leftover from current byte
		const bitsLeft = (~(this.offset - 1)) & 0b111
		const toConsume = Math.min(bitsLeft, remaining)
		remaining -= toConsume
		result |= ((this.data[pos++] & mask(bitsLeft)) >> (bitsLeft - toConsume)) << remaining
		// append next whole bytes, if any
		while (remaining >= 8)
			(remaining -= 8, result |= this.data[pos++] << remaining)
		// append beginning of last byte, if any
		if (remaining)
			result |= this.data[pos] >> (8 - remaining)

		this.offset += nBits
		return result >>> 0
	}
}
