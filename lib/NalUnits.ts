/**
 * Routines to parse the outer Network Access Layer, starting at the
 * byte stream format (Annex B) and ending at the containing SODB.
 *
 * @module
 */

import BitReader from "./BitReader.js"

// NAL
// ---

export enum NALUType {
	/** Coded slice of a non-IDR picture */
	SLICE_NON_IDR = 1,
	/** Coded slice data partition A */
	SLICE_PARTITION_A = 2,
	/** Coded slice data partition B */
	SLICE_PARTITION_B = 3,
	/** Coded slice data partition C */
	SLICE_PARTITION_C = 4,
	/** Coded slice of an IDR picture */
	SLICE_IDR = 5,
	/** Supplemental enhancement information */
	SEI = 6,
	/** Sequence parameter set */
	SPS = 7,
	/** Picture parameter set */
	PPS = 8,
	/** Access unit delimiter */
	AUD = 9,
	/** End of sequence */
	END_SEQ = 10,
	/** End of stream */
	END_STREAM = 11,
	/** Filler data */
	FILLER_DATA = 12,
	/** Sequence parameter set extension */
	SPS_EXT = 13,
	/** Prefix NAL unit */
	PREFIX_NALU = 14,
	/** Subset sequence parameter set */
	SUBSET_SPS = 15,
	/** Depth parameter set */
	DPS = 16,

	// 17, 18 reserved

	/** Coded slice of an auxiliary coded picture without partitioning */
	SLICE_AUX = 19,
	/** Coded slice extension */
	SLICE_EXT = 20,
	/** Coded slice extension for a depth view component or a 3D-AVC texture view component */
	SLICE_LAYER_EXT = 21,

	// 22, 23 reserved
}

export const NALU_TYPE_UNSPEC_START = 24

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
 * Note: Subarrays are returned. Before further parsing, {@link decodeRBSP} should be used.
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
export function sliceNALUs(
	stream: Uint8Array,
	options: {
		/**
		 * if true, the returned array contains the leading chunk of data before the
		 * first start code (possibly empty). if false, an error is thrown if this
		 * chunk is empty (default: false)
		 */
		includeLeading?: boolean,
	} = {},
): Uint8Array[] {
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
		if (start === 0 && !options.includeLeading) {
			if (end !== start)
				throw Error(`byte stream contains ${end} bytes of leading data`)
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

/**
 * check if we have reached the end of the SODB (trailing bits follow
 * immediately) or if there's more data
 */
export function moreRBSPData(reader: BitReader): boolean {
	if (!(reader.length - reader.offset <= 8))
		return true
	if (reader.length === reader.offset)
		return false
	reader = reader.clone()
	return !(reader.read1() && !reader.read(reader.length - reader.offset))
}
