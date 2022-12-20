
// CAUTION: returned in signed form (for n == 32, result is -1 not 0xFFFFFFFF)
const mask = (n: number) => ~((~0) << n)

/**
 * MSB-first bit reader
 *
 * All methods throw if an unexpected EOF is found
 */
export default class BitReader {
	constructor(public data: Uint8Array, public offset = 0, public length = data.length * 8 - offset) {
		if (!(offset === (offset >>> 0) && length === (length >>> 0) && offset <= length && length <= data.length * 8))
			throw new TypeError(`invalid offset / length`)
	}

	/** read a single bit */
	read1(): boolean {
		if (!(this.offset < this.length))
			throw new Error('unexpected EOF')
		const offset = this.offset++
		return Boolean(this.data[offset >>> 3] >> ((~offset) & 0b111))
	}

	/**
	 * read a fixed-size unsigned integer [u(n)]
	 *
	 * caution: only up to 32 bits supported
	 */
	read(nBits: number): number {
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

	/**
	 * read an exp-golomb unsigned integer [ue(v)]
	 *
	 * caution: only up to 32 bits guaranteed to be supported.
	 * will throw if a larger value is found.
	 */
	readExp(): number {
		let nBits = 0
		while (!this.read1())
			nBits++
		return this.read(nBits) + (mask(nBits) >>> 0)
	}

	/**
	 * read an exp-golomb signed integer [se(v)]
	 *
	 * same warning as for [[readExp]]
	 */
	readSExp(): number {
		const n = this.readExp()
		// undo zig-zag encoding
		if (n < 2) return n
		return (n + 1) >>> 1 | (-((n + 1) & 1))
	}
}
