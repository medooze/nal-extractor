/** Parsing of Sequence Parameter Sets and associated structures */

import BitReader from "./BitReader.js"
import { validateRBSPTrailing } from "./NalUnits.js"

export function validateSPSId(n: number) {
	if (n === (n >>> 0) && n < (1 << 5))
		return n
	throw Error(`invalid SPS ID ${n}`)
}


// SPS

export interface SPS {
	profile_idc: number,
	profile_compatibility: number,
	level_idc: number,

	seq_parameter_set_id: number,

	// for certain profiles
	chroma_format_idc?: number,
	separate_colour_plane_flag?: boolean | undefined,
	bit_depth_luma_minus8?: number,
	bit_depth_chroma_minus8?: number,
	qpprime_y_zero_transform_bypass_flag?: boolean,
	seq_scaling_matrix?: ScalingMatrix | undefined,

	log2_max_frame_num_minus4: number,
	pic_order_cnt_type: number,
	// for pic_order_cnt_type === 0
	log2_max_pic_order_cnt_lsb_minus4?: number,
	// for pic_order_cnt_type === 1
	delta_pic_order_always_zero_flag?: boolean,
	offset_for_non_ref_pic?: number,
	offset_for_top_to_bottom_field?: number,
	num_ref_frames_in_pic_order_cnt_cycle?: number,
	offset_for_ref_frame?: number[],

	max_num_ref_frames: number,
	gaps_in_frame_num_value_allowed_flag: boolean,
	pic_width_in_mbs_minus1: number,
	pic_height_in_map_units_minus1: number,
	frame_mbs_only_flag: boolean,
	mb_adaptive_frame_field_flag: boolean | undefined,
	direct_8x8_inference_flag: boolean,
	frame_cropping: false | {
		left_offset: number,
		right_offset: number,
		top_offset: number,
		bottom_offset: number,
	},

	vui_parameters: VUIParameters | undefined,
}

const ext_format_profile_idcs: { [key: number]: boolean } = {}
for (const x of [100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135])
	ext_format_profile_idcs[x] = true

/**
 * Parse an (already unescaped) SEI RBSP into raw messages.
 */
export function parseSPS(rbsp: Uint8Array): SPS {
	const reader = new BitReader(rbsp)

	const profile_idc = reader.read(8)
	const profile_compatibility = reader.read(8)
	const level_idc = reader.read(8)
	const seq_parameter_set_id = reader.readExp()

	const extension = ext_format_profile_idcs[profile_idc] ? (() => {
		const chroma_format_idc = reader.readExp()
		const separate_colour_plane_flag = chroma_format_idc === 3 ? reader.read1() : undefined
		const bit_depth_luma_minus8 = reader.readExp()
		const bit_depth_chroma_minus8 = reader.readExp()
		const qpprime_y_zero_transform_bypass_flag = reader.read1()
		const seq_scaling_matrix = parseScalingMatrix(reader, chroma_format_idc !== 3 ? 2 : 6)
		return { chroma_format_idc, separate_colour_plane_flag, bit_depth_luma_minus8, bit_depth_chroma_minus8, qpprime_y_zero_transform_bypass_flag, seq_scaling_matrix }
	})() : undefined

	const log2_max_frame_num_minus4 = reader.readExp()
	const pic_order_cnt_type = reader.readExp()
	const picOrderExtended =
		pic_order_cnt_type === 0 ? {
			log2_max_pic_order_cnt_lsb_minus4: reader.readExp(),
		} :
		pic_order_cnt_type === 1 ? {
			delta_pic_order_always_zero_flag: reader.read1(),
			offset_for_non_ref_pic: reader.readSExp(),
			offset_for_top_to_bottom_field: reader.readSExp(),
			...((() => {
				const num_ref_frames_in_pic_order_cnt_cycle = reader.readExp()
				const offset_for_ref_frame = [...Array(num_ref_frames_in_pic_order_cnt_cycle)].map(() => reader.readSExp())
				return { num_ref_frames_in_pic_order_cnt_cycle, offset_for_ref_frame }
			})()),
		} :
		undefined

	const max_num_ref_frames = reader.readExp()
	const gaps_in_frame_num_value_allowed_flag = reader.read1()
	const pic_width_in_mbs_minus1 = reader.readExp()
	const pic_height_in_map_units_minus1 = reader.readExp()
	const frame_mbs_only_flag = reader.read1()
	const mb_adaptive_frame_field_flag = !frame_mbs_only_flag ? reader.read1() : undefined
	const direct_8x8_inference_flag = reader.read1()
	const frame_cropping = reader.read1() ? {
		left_offset: reader.readExp(),
		right_offset: reader.readExp(),
		top_offset: reader.readExp(),
		bottom_offset: reader.readExp(),
	} : false

	const vui_parameters = reader.read1() ? parseVUIParameters(reader) : undefined

	validateRBSPTrailing(reader)
	return {
		profile_idc,
		profile_compatibility,
		level_idc,
		seq_parameter_set_id,

		...extension,

		log2_max_frame_num_minus4,
		pic_order_cnt_type,
		...picOrderExtended,

		max_num_ref_frames,
		gaps_in_frame_num_value_allowed_flag,
		pic_width_in_mbs_minus1,
		pic_height_in_map_units_minus1,
		frame_mbs_only_flag,
		mb_adaptive_frame_field_flag,
		direct_8x8_inference_flag,
		frame_cropping,
		vui_parameters,
	}
}


// Scaling list

interface ScalingList {
	useDefaultScalingMatrix: boolean
	coefficients: number[]
}

function parseScalingList(
	reader: BitReader,
	options: {
		sizeOfScalingList: number,
	},
): ScalingList {
	let lastScale = 8, nextScale = 8
	let useDefaultScalingMatrix = false
	const result = [...Array(options.sizeOfScalingList)].map((_, i) => {
		if (nextScale !== 0) {
			nextScale = (lastScale + reader.readSExp()) & 0xFF
			useDefaultScalingMatrix = (i === 0) && (nextScale === 0)
		}
		return (lastScale = (nextScale === 0) ? lastScale : nextScale)
	})
	return { coefficients: result, useDefaultScalingMatrix }
}

export interface ScalingMatrix {
	ScalingList4x4: (ScalingList | undefined)[]
	ScalingList8x8: (ScalingList | undefined)[]
}

// extracted because of common SPS / PPS code
export function parseScalingMatrix(reader: BitReader, n8x8: number): ScalingMatrix | undefined {
	return reader.read1() ? {
		ScalingList4x4: [...Array(6)].map(() =>
			reader.read1() ? parseScalingList(reader, { sizeOfScalingList: 16 }) : undefined),
		ScalingList8x8: [...Array(n8x8)].map(() =>
			reader.read1() ? parseScalingList(reader, { sizeOfScalingList: 64 }) : undefined),
	} : undefined
}


// VUI parameters (annex E)

export interface VUIParameters {
	aspect_ratio_info: {
		sar_width?: number | undefined,
		sar_height?: number | undefined,
		aspect_ratio_idc: number,
	} | undefined,
	overscan_info: {
		overscan_appropriate_flag: boolean,
	} | undefined,
	video_signal_type: {
		video_format: number,
		video_full_range_flag: boolean,
		colour_description: {
			colour_primaries: number,
			transfer_characteristics: number,
			matrix_coefficients: number,
		} | undefined,
	} | undefined,
	chroma_loc_info: {
		chroma_sample_loc_type_top_field: number,
		chroma_sample_loc_type_bottom_field: number,
	} | undefined,
	timing_info: {
		num_units_in_tick: number,
		time_scale: number,
		fixed_frame_rate_flag: boolean,
	} | undefined,
	nal_hrd_parameters: HRDParameters | undefined,
	vcl_hrd_parameters: HRDParameters | undefined,
	low_delay_hrd_flag: boolean | undefined,
	pic_struct_present_flag: boolean,
	bitstream_restriction: {
		motion_vectors_over_pic_boundaries_flag: boolean,
		max_bytes_per_pic_denom: number,
		max_bits_per_mb_denom: number,
		log2_max_mv_length_horizontal: number,
		log2_max_mv_length_vertical: number,
		max_num_reorder_frames: number,
		max_dec_frame_buffering: number,
	} | undefined,
}

const Extended_SAR = 0xFF

function parseVUIParameters(reader: BitReader): VUIParameters {
	const aspect_ratio_info = reader.read1() ? (() => {
		const aspect_ratio_idc = reader.read(8)
		const extended = aspect_ratio_idc === Extended_SAR ? {
			sar_width: reader.read(16),
			sar_height: reader.read(16),
		} : undefined
		return { aspect_ratio_idc, ...extended }
	})() : undefined

	const overscan_info = reader.read1() ? {
		overscan_appropriate_flag: reader.read1(),
	} : undefined

	const video_signal_type = reader.read1() ? {
		video_format: reader.read(3),
		video_full_range_flag: reader.read1(),
		colour_description: reader.read1() ? {
			colour_primaries: reader.read(8),
			transfer_characteristics: reader.read(8),
			matrix_coefficients: reader.read(8),
		} : undefined,
	} : undefined

	const chroma_loc_info = reader.read1() ? {
		chroma_sample_loc_type_top_field: reader.readExp(),
		chroma_sample_loc_type_bottom_field: reader.readExp(),
	} : undefined

	const timing_info = reader.read1() ? {
		num_units_in_tick: reader.read(32),
		time_scale: reader.read(32),
		fixed_frame_rate_flag: reader.read1(),
	} : undefined

	const nal_hrd_parameters = reader.read1() ? parseHRDParameters(reader) : undefined
	const vcl_hrd_parameters = reader.read1() ? parseHRDParameters(reader) : undefined

	const low_delay_hrd_flag = nal_hrd_parameters || vcl_hrd_parameters ? reader.read1() : undefined

	const pic_struct_present_flag = reader.read1()
	const bitstream_restriction = reader.read1() ? {
		motion_vectors_over_pic_boundaries_flag: reader.read1(),
		max_bytes_per_pic_denom: reader.readExp(),
		max_bits_per_mb_denom: reader.readExp(),
		log2_max_mv_length_horizontal: reader.readExp(),
		log2_max_mv_length_vertical: reader.readExp(),
		max_num_reorder_frames: reader.readExp(),
		max_dec_frame_buffering: reader.readExp(),
	} : undefined

	return {
		aspect_ratio_info,
		overscan_info,
		video_signal_type,
		chroma_loc_info,
		timing_info,
		nal_hrd_parameters,
		vcl_hrd_parameters,
		low_delay_hrd_flag,
		pic_struct_present_flag,
		bitstream_restriction,
	}
}


// HRD parameters (annex E)

export interface HRDParameters {
	bit_rate_scale: number,
	cpb_size_scale: number,
	SchedSels: {
		bit_rate_value_minus1: number,
		cpb_size_value_minus1: number,
		cbr_flag: boolean,
	}[],
	initial_cpb_removal_delay_length_minus1: number,
	cpb_removal_delay_length_minus1: number,
	dpb_output_delay_length_minus1: number,
	time_offset_length: number,
}

function parseHRDParameters(reader: BitReader): HRDParameters {
	const cpb_cnt_minus1 = reader.readExp()
	const bit_rate_scale = reader.read(4)
	const cpb_size_scale = reader.read(4)
	const SchedSels = [...Array(cpb_cnt_minus1 + 1)].map(() => ({
		bit_rate_value_minus1: reader.readExp(),
		cpb_size_value_minus1: reader.readExp(),
		cbr_flag: reader.read1(),
	}))
	const initial_cpb_removal_delay_length_minus1 = reader.read(5)
	const cpb_removal_delay_length_minus1 = reader.read(5)
	const dpb_output_delay_length_minus1 = reader.read(5)
	const time_offset_length = reader.read(5)

	return {
		bit_rate_scale,
		cpb_size_scale,
		SchedSels,
		initial_cpb_removal_delay_length_minus1,
		cpb_removal_delay_length_minus1,
		dpb_output_delay_length_minus1,
		time_offset_length,
	}
}
