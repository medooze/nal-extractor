import BitReader from "../BitReader.js"
import type { SPS } from "../SPS.js"
import { validateSEITrailing } from "./Message.js"

// PICTURE TIMING SEI
// ------------------

export enum PicStruct {
	PROGRESSIVE = 0,
	TOP = 1,
	BOTTOM = 2,
	TOP_BOTTOM = 3,
	BOTTOM_TOP = 4,
	TOP_BOTTOM_TOP = 5,
	BOTTOM_TOP_BOTTOM = 6,
	DOUBLING = 7,
	TRIPLING = 8,
}

const picStructNumClockTS = [ 1, 1, 1, 2, 2, 3, 3, 2, 3 ]

export interface PictureTimingParseOptions {
	CpbDpbDelaysPresentFlag?: boolean,
	cpb_removal_delay_length_minus1?: number,
	dpb_output_delay_length_minus1?: number,
	pic_struct_present_flag?: boolean,
	time_offset_length?: number,
	/** disable workarounds to tolerate broken encoders (default: false) */
	strict?: boolean,
}

export interface PictureTimestamp { ct_type: number,
	nuit_field_based_flag: boolean,
	counting_type: number,
	full_timestamp_flag: boolean,
	discontinuity_flag: boolean,
	cnt_dropped_flag: boolean,
	n_frames: number,
	seconds_value?: number,
	minutes_value?: number,
	hours_value?: number,
	time_offset: number,
}

export interface PictureTiming {
	// if `CpbDpbDelaysPresentFlag`...
	cpb_removal_delay?: number,
	dpb_output_delay?: number,
	// if `pic_struct_present_flag`...
	pic_struct?: number,
	timestamps?: (PictureTimestamp | undefined)[],
}

/**
 * Parse SEI picture timing message, given the payload and variables required
 * from the active SPS.
 */
export function parsePictureTiming(seiPayload: Uint8Array, options: PictureTimingParseOptions): PictureTiming {
	// add one extra byte into the payload, to tolerate broken encoders
	if (!options.strict) {
		const n = new Uint8Array(seiPayload.length + 1)
		n.set(seiPayload)
		seiPayload = n
	}

	const reader = new BitReader(seiPayload)
	const result = {
		...(options.CpbDpbDelaysPresentFlag ? {
			cpb_removal_delay: reader.read((options.cpb_removal_delay_length_minus1 || 0) + 1),
			dpb_output_delay: reader.read((options.dpb_output_delay_length_minus1 || 0) + 1),
		} : undefined),
		...(options.pic_struct_present_flag ? parsePicStruct() : undefined),
	}
	function parsePicStruct() {
		const pic_struct = reader.read(4)
		if (!(pic_struct < picStructNumClockTS.length))
			throw Error(`invalid pic_struct ${pic_struct}`)
		const NumClockTS = picStructNumClockTS[pic_struct]
		const timestamps = [...Array(NumClockTS)].map(() => parseTimestamp())
		return { pic_struct, timestamps }
	}
	function parseTimestamp() {
		if (!reader.read1())
			return undefined
		let result: PictureTimestamp = {
			ct_type: reader.read(2),
			nuit_field_based_flag: reader.read1(),
			counting_type: reader.read(5),
			full_timestamp_flag: reader.read1(),
			discontinuity_flag: reader.read1(),
			cnt_dropped_flag: reader.read1(),
			n_frames: reader.read(8),
			time_offset: 0,
		}
		if (result.full_timestamp_flag) {
			result.seconds_value = reader.read(6)
			result.minutes_value = reader.read(6)
			result.hours_value = reader.read(5)
		} else {
			if (reader.read1()) {
				result.seconds_value = reader.read(6)
				if (reader.read1()) {
					result.minutes_value = reader.read(6)
					if (reader.read1()) {
						result.hours_value = reader.read(5)
					}
				}
			}
		}
		result.time_offset = reader.read(options.time_offset_length || 0)
		return result
	}

	if (options.strict)
		validateSEITrailing(reader)
	return result
}

/**
 * derive parsing options for picture timing SEI messages from the active SPS
 */
export function parsePictureTimingOptionsFromSPS(sps: SPS): PictureTimingParseOptions {
	const hrd = sps.vui_parameters?.nal_hrd_parameters ?? sps.vui_parameters?.vcl_hrd_parameters
	return {
		CpbDpbDelaysPresentFlag: Boolean(hrd),
		cpb_removal_delay_length_minus1: hrd?.cpb_removal_delay_length_minus1 ?? 23,
		dpb_output_delay_length_minus1: hrd?.dpb_output_delay_length_minus1 ?? 23,
		time_offset_length: hrd?.time_offset_length ?? 24,
		pic_struct_present_flag: sps.vui_parameters?.pic_struct_present_flag ?? false,
	}
}
