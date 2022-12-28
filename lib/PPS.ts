/** Parsing of Picture Parameter Sets and associated structures */

import BitReader from "./BitReader.js"
import { moreRBSPData, validateRBSPTrailing } from "./NalUnits.js"
import { parseScalingMatrix, ScalingMatrix } from "./SPS.js"

export function validatePPSId(n: number) {
	if (n === (n >>> 0) && n < (1 << 8))
		return n
	throw Error(`invalid PPS ID ${n}`)
}


// PPS

export interface PPS {
	pic_parameter_set_id: number,
	seq_parameter_set_id: number,
	entropy_coding_mode_flag: boolean,
	bottom_field_pic_order_in_frame_present_flag: boolean,

	num_slice_groups_minus1: number,
	slice_group_map?: {
		slice_group_map_type: number,
		// for type === 0
		run_length_minus1?: number[],
		// for type === 2
		groups?: { top_left: number, bottom_right: number }[],
		// for type === 3, 4, 5
		slice_group_change_direction_flag?: boolean,
		slice_group_change_rate_minus1?: number,
		// for type === 6
		slice_group_id?: number[],
	} | undefined,

	num_ref_idx_l0_default_active_minus1: number,
	num_ref_idx_l1_default_active_minus1: number,
	weighted_pred_flag: boolean,
	weighted_bipred_idc: number,
	pic_init_qp_minus26: number,
	pic_init_qs_minus26: number,
	chroma_qp_index_offset: number,
	deblocking_filter_control_present_flag: boolean,
	constrained_intra_pred_flag: boolean,
	redundant_pic_cnt_present_flag: boolean,

	optionalTrailing?: {
		transform_8x8_mode_flag: boolean,
		pic_scaling_matrix?: ScalingMatrix | undefined,
		second_chroma_qp_index_offset: number,
	} | undefined,
}

export interface PPSParseOptions {
	chroma_format_idc(spsId: number): number
}

/**
 * Parse an (already unescaped) SEI RBSP into raw messages.
 */
export function parsePPS(rbsp: Uint8Array, options: PPSParseOptions): PPS {
	const reader = new BitReader(rbsp)

	const pic_parameter_set_id = reader.readExp()
	const seq_parameter_set_id = reader.readExp()
	const entropy_coding_mode_flag = reader.read1()
	const bottom_field_pic_order_in_frame_present_flag = reader.read1()

	const num_slice_groups_minus1 = reader.readExp()
	const slice_group_map = num_slice_groups_minus1 > 0 ? (() => {
		const slice_group_map_type = reader.readExp()
		const tmp = [...Array(num_slice_groups_minus1 + 1)]
		const exts =
			slice_group_map_type === 0 ? {
				run_length_minus1: tmp.map(() => reader.readExp()),
			} :
			slice_group_map_type === 1 ? {} :
			slice_group_map_type === 2 ? {
				groups: tmp.map(() => ({ top_left: reader.readExp(), bottom_right: reader.readExp() })),
			} :
			slice_group_map_type >= 3 && slice_group_map_type <= 5 ? {
				slice_group_change_direction_flag: reader.read1(),
				slice_group_change_rate_minus1: reader.readExp(),
			} :
			slice_group_map_type === 6 ? {
				slice_group_id: [...Array(reader.readExp() + 1)].map(() =>
					reader.read( Math.ceil(Math.log2(num_slice_groups_minus1 + 1 )) ))
			} :
			(() => { throw Error(`invalid slice_group_map_type ${slice_group_map_type}`) })()
		return { slice_group_map_type, ...exts }
	})() : undefined

	const num_ref_idx_l0_default_active_minus1 = reader.readExp()
	const num_ref_idx_l1_default_active_minus1 = reader.readExp()
	const weighted_pred_flag = reader.read1()
	const weighted_bipred_idc = reader.read(2)
	const pic_init_qp_minus26 = reader.readSExp()
	const pic_init_qs_minus26 = reader.readSExp()
	const chroma_qp_index_offset = reader.readSExp()
	const deblocking_filter_control_present_flag = reader.read1()
	const constrained_intra_pred_flag = reader.read1()
	const redundant_pic_cnt_present_flag = reader.read1()

	const optionalTrailing = moreRBSPData(reader) ? (() => {
		const transform_8x8_mode_flag = reader.read1()
		const chroma_format_idc = options.chroma_format_idc(seq_parameter_set_id)
		const n8x8 = transform_8x8_mode_flag ? (chroma_format_idc !== 3 ? 2 : 6) : 0
		const pic_scaling_matrix = parseScalingMatrix(reader, n8x8)
		const second_chroma_qp_index_offset = reader.readSExp()
		return { transform_8x8_mode_flag, pic_scaling_matrix, second_chroma_qp_index_offset }
	})() : undefined

	validateRBSPTrailing(reader)
	return {
		pic_parameter_set_id,
		seq_parameter_set_id,
		entropy_coding_mode_flag,
		bottom_field_pic_order_in_frame_present_flag,

		num_slice_groups_minus1,
		slice_group_map,

		num_ref_idx_l0_default_active_minus1,
		num_ref_idx_l1_default_active_minus1,
		weighted_pred_flag,
		weighted_bipred_idc,
		pic_init_qp_minus26,
		pic_init_qs_minus26,
		chroma_qp_index_offset,
		deblocking_filter_control_present_flag,
		constrained_intra_pred_flag,
		redundant_pic_cnt_present_flag,

		optionalTrailing,
	}
}
