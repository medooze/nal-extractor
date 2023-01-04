/**
 * Parses and accumulates received parameter sets, and manages their activation
 *
 * @module
 */

import { parseSPS, SPS, validateSPSId } from "./SPS.js"
import { parsePPS, PPS, validatePPSId } from "./PPS.js"
import { NALUType, parseNALU, decodeRBSP } from "./NalUnits.js"
import BitReader from "./BitReader.js"

export default class SetManager {
	/**
	 * Processes the given NALU, if applicable.
	 * Returns true if the NALU was handled, false if it was ignored.
	 */
	processNALU(nalu: ReturnType<typeof parseNALU>): boolean {
		const type = nalu.nal_unit_type
		if (type === NALUType.SPS) {
			this.processSPS(nalu.rbsp)
			return true
		} else if (type === NALUType.PPS) {
			this.processPPS(nalu.rbsp)
			return true
		} else if (type === NALUType.SLICE_IDR || type === NALUType.SLICE_NON_IDR || type === NALUType.SLICE_PARTITION_A) { // slice
			// we need to parse far enough to get to the PPS ID, which involves skipping over two ue(v) fields first.
			// these fields (first_mb_in_slice and slice_type) aren't small enough in value to guarantee there will be
			// no more than 22 consecutive zeros (necessary to trigger an emulation_prevention_three_byte). so, decode
			// an initial bit of the RBSP to be sure:
			const reader = new BitReader(decodeRBSP(nalu.rbsp.subarray(0, 16)))
			reader.readExp()
			reader.readExp()
			this.activate(reader.readExp())
			return true
		}
		return false
	}

	// parsing / retaining

	/** SPS received so far */
	receivedSPS: { [id: number]: SPS } = {}
	/** PPS received so far */
	receivedPPS: { [id: number]: PPS } = {}

	/**
	 * Parses and stores the specified SPS, given the *encoded* RBSP.
	 * You typically want to use {@link processNALU} instead.
	 */
	processSPS(rbsp: Uint8Array): void {
		const sps = parseSPS(decodeRBSP(rbsp))
		const id = validateSPSId(sps.seq_parameter_set_id)
		this.receivedSPS[id] = sps
	}

	/**
	 * Parses and stores the specified SPS, given the *encoded* RBSP.
	 * You typically want to use {@link processNALU} instead.
	 */
	processPPS(rbsp: Uint8Array): void {
		const pps = parsePPS(decodeRBSP(rbsp), {
			chroma_format_idc: (spsId: number) => {
				if (!(spsId in this.receivedSPS))
					throw Error(`referenced missing SPS ${spsId}`)
				return this.receivedSPS[spsId].chroma_format_idc ?? 1
			},
		})
		const id = validatePPSId(pps.pic_parameter_set_id)
		this.receivedPPS[id] = pps
	}

	// activation

	/** Currently active SPS, if any */
	currentSPS?: SPS
	/** Currently active PPS, if any */
	currentPPS?: PPS

	/** Activate the specified PPS */
	activate(ppsId: number): void {
		// activate PPS
		if (!(ppsId in this.receivedPPS))
			throw Error(`activated missing PPS ${ppsId}`)
		this.currentPPS = this.receivedPPS[ppsId]
		const spsId = this.currentPPS.seq_parameter_set_id

		// activate SPS
		if (!(spsId in this.receivedSPS))
			throw Error(`activated missing SPS ${spsId}`)
		this.currentSPS = this.receivedSPS[spsId]
	}
}
