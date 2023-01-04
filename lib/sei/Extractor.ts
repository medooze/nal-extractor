/**
 * Extracts and parses SEI from access units
 *
 * @module
 */

import { parseNALU, sliceNALUs, NALUType, decodeRBSP } from "../NalUnits.js"
import SetManager from "../SetManager.js"

import { SEIMessageType } from "./MessageType.js"
import { parseSEI, RawSEIMessage } from "./Message.js"
import { parseUserDataUnregistered } from "./UserDataUnregistered.js"
import { parsePictureTiming, parsePictureTimingOptionsFromSPS, PictureTimingParseOptions } from "./PictureTiming.js"

export interface SEIExtractorOptions {
	/** parse unregistered user data messages (default: true) */
	enableUserDataUnregistered?: boolean
	/** parse picture timing messages (default: false) */
	enablePicTiming?: boolean,
	/** when parsing picture timing messages, assume cpb_removal_delay and dpb_output_delay are present, even if not enabled in SPS (default: false) */
	forceCpbDpbDelaysPresent?: boolean,
}

export type SEIExtractedMessage =
	{ type: SEIMessageType.USER_DATA_UNREGISTERED, uuid: bigint, data: Uint8Array } |
	{ type: SEIMessageType.PIC_TIMING, message: ReturnType<typeof parsePictureTiming> }

export default class SEIExtractor {
	psManager = new SetManager()

	constructor(public options: SEIExtractorOptions) {}

	/**
	 * Process the next AU, in decoding order, and return the extracted messages.
	 */
	processAU(data: Uint8Array) {
		const nalus = sliceNALUs(data).map(parseNALU)
		const messages: SEIExtractedMessage[] = []

		if (this.options.enablePicTiming) {
			// parsing of certain SEIs depends on the active SPS for this AU.
			// because the active SPS is sometimes not known until we reach
			// the first slice NALU, we must do a first pass before actually
			// parsing the SEI
			for (const nalu of nalus) {
				this.psManager.processNALU(nalu)
				const type = nalu.nal_unit_type
				if (type === NALUType.SLICE_IDR || type === NALUType.SLICE_NON_IDR || type === NALUType.SLICE_PARTITION_A)
					break // done
			}
		}

		const processMessage = ([ type, data ]: RawSEIMessage) => {
			if (type === SEIMessageType.USER_DATA_UNREGISTERED && (this.options.enableUserDataUnregistered ?? true))
				messages.push({ type, ...parseUserDataUnregistered(data) })
			else if (type === SEIMessageType.PIC_TIMING && this.options.enablePicTiming)
				messages.push({ type, message: parsePictureTiming(data, this.derivePicTimingOptions()) })
		}

		for (const nalu of nalus) {
			if (nalu.nal_unit_type === NALUType.SEI)
				parseSEI(decodeRBSP(nalu.rbsp)).forEach(processMessage)
		}

		return messages
	}

	protected derivePicTimingOptions(): PictureTimingParseOptions {
		if (!this.psManager.currentSPS)
			throw Error('cannot parse picture timing: no current SPS')
		const options = parsePictureTimingOptionsFromSPS(this.psManager.currentSPS)
		if (this.options.forceCpbDpbDelaysPresent)
			options.CpbDpbDelaysPresentFlag = true
		return options
	}
}
