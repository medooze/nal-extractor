import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parsePictureTiming, PicStruct, SEIExtractor, SEIMessageType } from "../../lib"

const readSample = (x: string) =>
	readFileSync(join(__dirname, '..', 'samples', x))

describe('SEIExtractor', () => {
	it('picture timing test', () => {
		const extractor = new SEIExtractor({
			enablePicTiming: true,
		})

		const expectedMessages: (ReturnType<typeof parsePictureTiming> | false)[] = [
			false,
			{
				pic_struct: PicStruct.PROGRESSIVE,
				timestamps: [{
					ct_type: 0,
					nuit_field_based_flag: false,
					counting_type: 0,
					full_timestamp_flag: true,
					discontinuity_flag: true,
					cnt_dropped_flag: false,
					hours_value: 19,
					minutes_value: 15,
					seconds_value: 8,
					n_frames: 14,
					time_offset: 0
				}]
			},
			{
				pic_struct: PicStruct.PROGRESSIVE,
				timestamps: [{
					ct_type: 0,
					nuit_field_based_flag: false,
					counting_type: 0,
					full_timestamp_flag: true,
					discontinuity_flag: true,
					cnt_dropped_flag: false,
					hours_value: 19,
					minutes_value: 15,
					seconds_value: 8,
					n_frames: 15,
					time_offset: 0
				}]
			},
			{
				pic_struct: PicStruct.PROGRESSIVE,
				timestamps: [{
					ct_type: 0,
					nuit_field_based_flag: false,
					counting_type: 0,
					full_timestamp_flag: true,
					discontinuity_flag: true,
					cnt_dropped_flag: false,
					hours_value: 19,
					minutes_value: 15,
					seconds_value: 8,
					n_frames: 16,
					time_offset: 0
				}]
			},
		]

		for (const [i, expectedMsg] of expectedMessages.entries()) {
			expect(extractor.processAU(readSample(`pic-${i+1}.bin`))).toStrictEqual(
				expectedMsg !== false ?
					[ { type: SEIMessageType.PIC_TIMING, message: expectedMsg } ] :
					[]
			)
		}
	})
})
