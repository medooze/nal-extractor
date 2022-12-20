import { decodeRBSP, parseNALU } from "../lib/NalUnits"
import { parseSPS, SPS } from "../lib/SPS"

function fullParseSPS(naluHex: string, expected: SPS) {
	const data = Buffer.from(naluHex, 'hex')
	const nalu = parseNALU(data)
	expect(nalu.forbidden_zero_bit).toBe(0)
	expect(nalu.nal_unit_type).toBe(7) // FIXME
	// not checking nalu.nal_ref_idc
	const parsed = parseSPS(decodeRBSP(nalu.rbsp))
	expect(parsed).toStrictEqual(expected)
}

describe('SPS parsing', () => {
	it('basic tests', () => {
		fullParseSPS('6764001fad84010c20086100430802184010c200843b502802dd35010101400145d8c04c4b4025', {
			profile_idc: 0,
			profile_compatibility: 0,
			level_idc: 173,
			seq_parameter_set_id: 0,
			log2_max_frame_num_minus4: 0,
			pic_order_cnt_type: 0,
			log2_max_pic_order_cnt_lsb_minus4: 0,
			max_num_ref_frames: 0,
			gaps_in_frame_num_value_allowed_flag: true,
			pic_width_in_mbs_minus1: 0,
			pic_height_in_map_units_minus1: 0,
			frame_mbs_only_flag: true,
			mb_adaptive_frame_field_flag: undefined,
			direct_8x8_inference_flag: true,
			frame_cropping: { left_offset: 0, right_offset: 0, top_offset: 0, bottom_offset: 0 },
			vui_parameters: {
				aspect_ratio_info: undefined,
				overscan_info: undefined,
				video_signal_type: undefined,
				chroma_loc_info: undefined,
				timing_info: undefined,
				nal_hrd_parameters: undefined,
				vcl_hrd_parameters: undefined,
				low_delay_hrd_flag: undefined,
				pic_struct_present_flag: true,
				bitstream_restriction: undefined
			}
		})
	})
})
