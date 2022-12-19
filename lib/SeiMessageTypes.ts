const seiMessageTypes = {
	buffering_period: 0,
	/** parseable using [[parsePictureTiming]] */
	pic_timing: 1,
	pan_scan_rect: 2,
	filler_payload: 3,
	user_data_registered_itu_t_t35: 4,
	/** parseable using [[parseUserDataUnregistered]] */
	user_data_unregistered: 5,
	recovery_point: 6,
	dec_ref_pic_marking_repetition: 7,
	spare_pic: 8,
	scene_info: 9,
	sub_seq_info: 10,
	sub_seq_layer_characteristics: 11,
	sub_seq_characteristics: 12,
	full_frame_freeze: 13,
	full_frame_freeze_release: 14,
	full_frame_snapshot: 15,
	progressive_refinement_segment_start: 16,
	progressive_refinement_segment_end: 17,
	motion_constrained_slice_group_set: 18,
	film_grain_characteristics: 19,
	deblocking_filter_display_preference: 20,
	stereo_video_info: 21,
	post_filter_hint: 22,
	tone_mapping_info: 23,
	/** specified in Annex G */
	scalability_info: 24,
	/** specified in Annex G */
	sub_pic_scalable_layer: 25,
	/** specified in Annex G */
	non_required_layer_rep: 26,
	/** specified in Annex G */
	priority_layer_info: 27,
	/** specified in Annex G */
	layers_not_present: 28,
	/** specified in Annex G */
	layer_dependency_change: 29,
	/** specified in Annex G */
	scalable_nesting: 30,
	/** specified in Annex G */
	base_layer_temporal_hrd: 31,
	/** specified in Annex G */
	quality_layer_integrity_check: 32,
	/** specified in Annex G */
	redundant_pic_property: 33,
	/** specified in Annex G */
	tl0_dep_rep_index: 34,
	/** specified in Annex G */
	tl_switching_point: 35,
	/** specified in Annex H */
	parallel_decoding_info: 36,
	/** specified in Annex H */
	mvc_scalable_nesting: 37,
	/** specified in Annex H */
	view_scalability_info: 38,
	/** specified in Annex H */
	multiview_scene_info: 39,
	/** specified in Annex H */
	multiview_acquisition_info: 40,
	/** specified in Annex H */
	non_required_view_component: 41,
	/** specified in Annex H */
	view_dependency_change: 42,
	/** specified in Annex H */
	operation_points_not_present: 43,
	/** specified in Annex H */
	base_view_temporal_hrd: 44,
	frame_packing_arrangement: 45,
	/** specified in Annex H */
	multiview_view_position: 46,
	display_orientation: 47,
	/** specified in Annex I */
	mvcd_scalable_nesting: 48,
	/** specified in Annex I */
	mvcd_view_scalability_info: 49,
	/** specified in Annex I */
	depth_representation_info: 50,
	/** specified in Annex I */
	three_dimensional_reference_displays_info: 51,
	/** specified in Annex I */
	depth_timing: 52,
	/** specified in Annex I */
	depth_sampling_info: 53,
	/** specified in Annex J */
	constrained_depth_parameter_set_identifier: 54,
	/** specified in ISO/IEC 23001-11 */
	green_metadata: 56,
	mastering_display_colour_volume: 137,
	colour_remapping_info: 142,
	content_light_level_info: 144,
	alternative_transfer_characteristics: 147,
	ambient_viewing_environment: 148,
	content_colour_volume: 149,
	equirectangular_projection: 150,
	cubemap_projection: 151,
	sphere_rotation: 154,
	regionwise_packing: 155,
	omni_viewport: 156,
	/** specified in Annex I */
	alternative_depth_info: 181,
	sei_manifest: 200,
	sei_prefix_indication: 201,
}

export default seiMessageTypes
