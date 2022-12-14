import BitReader from "./BitReader"

// PICTURE TIMING SEI
// ------------------

export const picStruct = {
	progressive: 0,
	top: 1,
	bottom: 2,
	topBottom: 3,
	bottomTop: 4,
	topBottomTop: 5,
	bottomTopBottom: 6,
	doubling: 7,
	tripling: 8,
}

const picStructNumClockTS = [ 1, 1, 1, 2, 2, 3, 3, 2, 3 ]

/**
 * @typedef {{
 *   CpbDpbDelaysPresentFlag?: boolean,
 *   cpb_removal_delay_length_minus1?: number,
 *   dpb_output_delay_length_minus1?: number,
 *   pic_struct_present_flag?: boolean,
 *   time_offset_length?: number,
 * }} PictureTimingParseOptions
 */

/**
 * Parse SEI picture timing message, given the payload and variables required
 * from the active SPS.
 */
export function parsePictureTiming(/** @type {Uint8Array} */ seiPayload, /** @type {PictureTimingParseOptions} */ options) {
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
		let result = {
			ct_type: reader.read(2),
			nuit_field_based_flag: reader.read1(),
			counting_type: reader.read(5),
			full_timestamp_flag: reader.read1(),
			discontinuity_flag: reader.read1(),
			cnt_dropped_flag: reader.read1(),
			n_frames: reader.read(8),
			seconds_value: /** @type {number | undefined} */ (undefined),
			minutes_value: /** @type {number | undefined} */ (undefined),
			hours_value: /** @type {number | undefined} */ (undefined),
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
	validateSEITrailing(reader)
	return result
}