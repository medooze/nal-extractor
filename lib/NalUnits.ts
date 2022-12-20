import BitReader from "./BitReader.js"

// NAL
// ---

export const NALU_TYPE_SEI = 6

/**
 * Parse the first byte of a NALU
 */
export const parseNALUPrefix = (octet: number) => ({
	forbidden_zero_bit: octet >> 7,
	nal_ref_idc: (octet >> 5) & 0b11,
	nal_unit_type: octet & 0b11111,
})

export interface RawNALU {
	forbidden_zero_bit: number,
	nal_ref_idc: number,
	nal_unit_type: number,
	extensions?: Uint8Array,
	rbsp: Uint8Array,
}

/**
 * Parse outer layer of a NALU
 *
 * Note: Subarrays are returned. Before further parsing, [[decodeRBSP]] should be used.
 */
export function parseNALU(nalu: Uint8Array) {
	if (nalu.length < 1)
		throw TypeError('EOF found when reading NALU prefix')
	const prefix = parseNALUPrefix(nalu[0])
	if (prefix.nal_unit_type === 14 || prefix.nal_unit_type === 20 || prefix.nal_unit_type === 21)
		throw Error('TODO: implement extension')
	return { ...prefix, rbsp: nalu.subarray(1) }
}

/**
 * Decode (unescape) the RBSP part of a NALU, by removing `emulation_prevention_three_byte`
 *
 * Note: if passed, `out` is assumed to be large enough to hold result
 * @returns same array passed at `out`
 */
export function decodeRBSP(
	rbsp: Uint8Array,
	out = new Uint8Array(rbsp.length),
): Uint8Array {
	// FIXME: we could throw on invalid sequences
	let outPos = 0, inPos = 0, cursor = 2
	for (; cursor < rbsp.length; cursor++) {
		if (rbsp[cursor] === 3 && rbsp[cursor - 1] === 0 && rbsp[cursor - 2] === 0) {
			out.set(rbsp.subarray(inPos, cursor), outPos)
			outPos += cursor - inPos
			inPos = cursor + 1
		}
	}
	out.set(rbsp.subarray(inPos, cursor), outPos)
	outPos += cursor - inPos
	return out.subarray(0, outPos)
}

/**
 * Slice the NALUs present in the supplied buffer, assuming it is already byte-aligned
 */
export function sliceNALUs(stream: Uint8Array): Uint8Array[] {
	const result = []
	let start = 0, pos = 0, searchLength = stream.length - 2
	while (pos < searchLength) {
		// skip until end of current NALU
		while (pos < searchLength && !(stream[pos] === 0 && stream[pos+1] === 0 && stream[pos+2] === 1))
			pos++
		if (pos >= searchLength)
			pos = stream.length
		// remove trailing zeros from current NALU
		let end = pos
		while (end > start && stream[end-1] === 0)
			end--
		// save current NALU
		if (start === 0) {
			if (end !== start) throw TypeError('byte stream contains leading data')
		} else {
			result.push(stream.subarray(start, end))
		}
		// begin new NALU
		start = pos = pos + 3
	}
	return result
}

/**
 * validate the trailing bits (and EOF) of an RBSP
 */
export function validateRBSPTrailing(reader: BitReader): void {
	if (!(reader.length - reader.offset <= 8))
		throw TypeError(`unexpected trailing data found: ${reader.length - reader.offset} bits`)
	if (!(reader.read1() && !reader.read(reader.length - reader.offset)))
		throw TypeError('unexpected alignment trailing bits')
}
