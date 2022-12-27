import { decodeRBSP, NALUType, parseNALU } from "../lib/NalUnits.js"
import { parsePPS, PPS, validatePPSId } from "../lib/PPS.js"

function fullParsePPS(naluHex: string, chroma_format_idc: number, expected: PPS) {
	const data = Buffer.from(naluHex, 'hex')
	const nalu = parseNALU(data)
	expect(nalu.forbidden_zero_bit).toBe(0)
	expect(nalu.nal_unit_type).toBe(NALUType.PPS)
	// not checking nalu.nal_ref_idc
	const options = { chroma_format_idc: () => chroma_format_idc }
	const parsed = parsePPS(decodeRBSP(nalu.rbsp), options)
	expect(parsed).toStrictEqual(expected)
}

describe('PPS parsing', () => {
	it('basic tests', () => {
		fullParsePPS('68ee3cb0', 1, {
			pic_parameter_set_id: 0,
			seq_parameter_set_id: 0,
			entropy_coding_mode_flag: true,
			bottom_field_pic_order_in_frame_present_flag: false,

			num_slice_groups_minus1: 0,
			slice_group_map: undefined,

			num_ref_idx_l0_default_active_minus1: 0,
			num_ref_idx_l1_default_active_minus1: 0,
			weighted_pred_flag: false,
			weighted_bipred_idc: 0,
			pic_init_qp_minus26: 0,
			pic_init_qs_minus26: 0,
			chroma_qp_index_offset: 0,
			deblocking_filter_control_present_flag: true,
			constrained_intra_pred_flag: false,
			redundant_pic_cnt_present_flag: false,

			optionalTrailing: {
				transform_8x8_mode_flag: true,
				pic_scaling_matrix: undefined,
				second_chroma_qp_index_offset: 0,
			}
		})

		fullParsePPS('68e8430f2c8b', 1, {
			pic_parameter_set_id: 0,
			seq_parameter_set_id: 0,
			entropy_coding_mode_flag: true,
			bottom_field_pic_order_in_frame_present_flag: false,

			num_slice_groups_minus1: 0,
			slice_group_map: undefined,

			num_ref_idx_l0_default_active_minus1: 15,
			num_ref_idx_l1_default_active_minus1: 0,
			weighted_pred_flag: true,
			weighted_bipred_idc: 0,
			pic_init_qp_minus26: -3,
			pic_init_qs_minus26: 0,
			chroma_qp_index_offset: -2,
			deblocking_filter_control_present_flag: true,
			constrained_intra_pred_flag: false,
			redundant_pic_cnt_present_flag: false,

			optionalTrailing: {
				transform_8x8_mode_flag: true,
				pic_scaling_matrix: undefined,
				second_chroma_qp_index_offset: -2,
			}
		})

		fullParsePPS('68ebe3cb22c0', 1, {
			pic_parameter_set_id: 0,
			seq_parameter_set_id: 0,
			entropy_coding_mode_flag: true,
			bottom_field_pic_order_in_frame_present_flag: false,

			num_slice_groups_minus1: 0,
			slice_group_map: undefined,

			num_ref_idx_l0_default_active_minus1: 2,
			num_ref_idx_l1_default_active_minus1: 0,
			weighted_pred_flag: true,
			weighted_bipred_idc: 2,
			pic_init_qp_minus26: -3,
			pic_init_qs_minus26: 0,
			chroma_qp_index_offset: -2,
			deblocking_filter_control_present_flag: true,
			constrained_intra_pred_flag: false,
			redundant_pic_cnt_present_flag: false,

			optionalTrailing: {
				transform_8x8_mode_flag: true,
				pic_scaling_matrix: undefined,
				second_chroma_qp_index_offset: -2,
			}
		})
	})

	it('fails on invalid inputs', () => {
		expect(() => parsePPS(Buffer.from('ee3cb0', 'hex'), { chroma_format_idc: () => 1 }))
			.not.toThrow()
		// invalid trailing
		expect(() => parsePPS(Buffer.from('ee3cb1', 'hex'), { chroma_format_idc: () => 1 }))
			.toThrow()
		// cut short
		expect(() => parsePPS(Buffer.from('ee3c', 'hex'), { chroma_format_idc: () => 1 }))
			.toThrow()
	})

	it('validates IDs', () => {
		expect(validatePPSId(0)).toBe(0)
		expect(validatePPSId(255)).toBe(255)
		expect(() => validatePPSId(-1)).toThrow()
		expect(() => validatePPSId(256)).toThrow()
		expect(() => validatePPSId(0.1)).toThrow()
		expect(() => validatePPSId(NaN)).toThrow()
	})
})
