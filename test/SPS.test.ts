import { describe, expect, it } from "@jest/globals"
import { decodeRBSP, NALUType, parseNALU } from "../lib/NalUnits.js"
import { parseSPS, SPS, validateSPSId } from "../lib/SPS.js"

function fullParseSPS(naluHex: string, expected: SPS) {
	const data = Buffer.from(naluHex, 'hex')
	const nalu = parseNALU(data)
	expect(nalu.forbidden_zero_bit).toBe(0)
	expect(nalu.nal_unit_type).toBe(NALUType.SPS)
	// not checking nalu.nal_ref_idc
	const parsed = parseSPS(decodeRBSP(nalu.rbsp))
	expect(parsed).toStrictEqual(expected)
}

describe('SPS parsing', () => {
	it('basic tests', () => {
		fullParseSPS('6764001fad84010c20086100430802184010c200843b502802dd35010101400145d8c04c4b4025', {
			profile_idc: 100,
			profile_compatibility: 0,
			level_idc: 31,

			seq_parameter_set_id: 0,

			chroma_format_idc: 1,
			separate_colour_plane_flag: undefined,
			bit_depth_luma_minus8: 0,
			bit_depth_chroma_minus8: 0,
			qpprime_y_zero_transform_bypass_flag: false,
			seq_scaling_matrix: {
				ScalingList4x4: [
					{ coefficients: [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], useDefaultScalingMatrix: false },
					{ coefficients: [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], useDefaultScalingMatrix: false },
					{ coefficients: [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], useDefaultScalingMatrix: false },
					{ coefficients: [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], useDefaultScalingMatrix: false },
					{ coefficients: [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], useDefaultScalingMatrix: false },
					{ coefficients: [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], useDefaultScalingMatrix: false },
				],
				ScalingList8x8: [
					undefined,
					undefined,
				],
			},

			log2_max_frame_num_minus4: 6,
			pic_order_cnt_type: 2,

			max_num_ref_frames: 1,
			gaps_in_frame_num_value_allowed_flag: true,
			pic_width_in_mbs_minus1: 79,
			pic_height_in_map_units_minus1: 44,
			frame_mbs_only_flag: true,
			mb_adaptive_frame_field_flag: undefined,
			direct_8x8_inference_flag: true,
			frame_cropping: false,
			vui_parameters: {
				aspect_ratio_info: undefined,
				overscan_info: undefined,
				video_signal_type: {
					video_format: 5,
					video_full_range_flag: false,
					colour_description: {
						colour_primaries: 1,
						matrix_coefficients: 1,
						transfer_characteristics: 1,
					},
				},
				chroma_loc_info: undefined,
				timing_info: {
					num_units_in_tick: 333667,
					time_scale: 20000000,
					fixed_frame_rate_flag: true
				},
				nal_hrd_parameters: undefined,
				vcl_hrd_parameters: undefined,
				low_delay_hrd_flag: undefined,
				pic_struct_present_flag: true,
				bitstream_restriction: undefined,
			},
		})

		fullParseSPS('6764001eacb2010020f3cf80b5060606a50000030001000003003c9f162e48', {
			profile_idc: 100,
			profile_compatibility: 0,
			level_idc: 30,
			seq_parameter_set_id: 0,

			chroma_format_idc: 1,
			separate_colour_plane_flag: undefined,
			bit_depth_luma_minus8: 0,
			bit_depth_chroma_minus8: 0,
			qpprime_y_zero_transform_bypass_flag: false,
			seq_scaling_matrix: undefined,

			log2_max_frame_num_minus4: 0,
			pic_order_cnt_type: 2,
			max_num_ref_frames: 3,
			gaps_in_frame_num_value_allowed_flag: false,
			pic_width_in_mbs_minus1: 31,
			pic_height_in_map_units_minus1: 31,
			frame_mbs_only_flag: true,
			mb_adaptive_frame_field_flag: undefined,
			direct_8x8_inference_flag: true,
			frame_cropping: { left_offset: 0, right_offset: 6, top_offset: 0, bottom_offset: 6 },

			vui_parameters: {
				aspect_ratio_info: { aspect_ratio_idc: 1 },
				overscan_info: undefined,
				video_signal_type: {
					video_format: 5,
					video_full_range_flag: false,
					colour_description: {
						colour_primaries: 6,
						matrix_coefficients: 6,
						transfer_characteristics: 6,
					},
				},
				chroma_loc_info: {
					chroma_sample_loc_type_top_field: 1,
					chroma_sample_loc_type_bottom_field: 1,
				},
				timing_info: {
					num_units_in_tick: 1,
					time_scale: 60,
					fixed_frame_rate_flag: true,
				},
				nal_hrd_parameters: undefined,
				vcl_hrd_parameters: undefined,
				low_delay_hrd_flag: undefined,
				pic_struct_present_flag: true,
				bitstream_restriction: {
					motion_vectors_over_pic_boundaries_flag: true,
					max_bytes_per_pic_denom: 0,
					max_bits_per_mb_denom: 0,
					log2_max_mv_length_horizontal: 10,
					log2_max_mv_length_vertical: 10,
					max_num_reorder_frames: 0,
					max_dec_frame_buffering: 3,
				},
			}
		})
	})

	it('fails on invalid inputs', () => {
		expect(() => parseSPS(Buffer.from('64001fad84010c20086100430802184010c200843b502802dd35010101400145d8c04c4b4025', 'hex')))
			.not.toThrow()
		// invalid trailing
		expect(() => parseSPS(Buffer.from('64001fad84010c20086100430802184010c200843b502802dd35010101400145d8c04c4b4024', 'hex')))
			.toThrow()
		expect(() => parseSPS(Buffer.from('64001fad84010c20086100430802184010c200843b502802dd35010101400145d8c04c4b4026', 'hex')))
			.toThrow()
		expect(() => parseSPS(Buffer.from('64001fad84010c20086100430802184010c200843b502802dd35010101400145d8c04c4b402500', 'hex')))
			.toThrow()
		// valid trailing, but extra data
		expect(() => parseSPS(Buffer.from('64001fad84010c20086100430802184010c200843b502802dd35010101400145d8c04c4b402401', 'hex')))
			.toThrow()
		// cut short
		expect(() => parseSPS(Buffer.from('64001fad84010c20086100430802184010', 'hex')))
			.toThrow()
	})

	it('validates IDs', () => {
		expect(validateSPSId(0)).toBe(0)
		expect(validateSPSId(31)).toBe(31)
		expect(() => validateSPSId(-1)).toThrow()
		expect(() => validateSPSId(32)).toThrow()
		expect(() => validateSPSId(0.1)).toThrow()
		expect(() => validateSPSId(NaN)).toThrow()
	})
})
