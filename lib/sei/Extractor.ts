/**
 * Extracts and parses SEI from access units
 *
 * @module
 */

import { parseNALU, sliceNALUs, NALUType, decodeRBSP, RawNALU } from "../NalUnits.js"
import SetManager from "../SetManager.js"

import { SEIMessageType } from "./MessageType.js"
import { parseSEI, RawSEIMessage } from "./Message.js"
import { parseUserDataUnregistered } from "./UserDataUnregistered.js"
import { parsePictureTiming, parsePictureTimingOptionsFromSPS, PictureTimingParseOptions } from "./PictureTiming.js"

export interface SEIExtractorOptions {
	/** behavior on parsing errors. override `handleError` for finer control (default: log) */
	errors?: 'throw' | 'log'
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

export class SEIExtractorError extends Error {
	constructor(
		/**
		 * source of the error:
		 *  - `byteStream` (when slicing/parsing NALUs from the byte stream)
		 *  - `psManager` (when `SetManager` was preprocessing a NALU),
		 *  - `nalu` (when parsing the SEI NALU itself)
		 *  - `message` (when parsing a SEI message)
		 *  - `missingPs` (parsing failed due to missing SPS/PPS)
		 *
		 * unstable, treat with care.
		 */
		public context: 'byteStream' | 'psManager' | 'nalu' | 'message' | 'missingPs',
		/** original error */
		public override cause: unknown,
	) {
		super(SEIExtractorError.formatMessage(context), { cause })
		this.name = 'SEIExtractorError'
	}

	private static formatMessage(context: SEIExtractorError['context']): string {
		return (
			context === 'psManager' ? 'Error when processing parameter sets' :
			context === 'nalu' ? 'Error when parsing SEI NALU' :
			context === 'message' ? 'Error when parsing SEI message' :
			context === 'missingPs' ? 'Parsing failed due to missing SPS/PPS' :
			'Unknown parsing error'
		)
	}
}

const wrapError = (context: SEIExtractorError['context'], err: unknown) =>
	(err && (err as Error).name === 'SEIExtractorError') ?
		(err as SEIExtractorError) :
		new SEIExtractorError(context, err)

export default class SEIExtractor {
	psManager = new SetManager()
	mutePsErrors = true

	constructor(public options: SEIExtractorOptions = {}) {}

	/**
	 * Process the next AU, in decoding order, and return the extracted messages.
	 */
	processAU(
		/** AU data, in Annex B byte stream format */
		data: Uint8Array | ArrayBuffer
	) {
		const bytes = ArrayBuffer.isView(data) ? data : new Uint8Array(data)

		// slice / parse NALUs from the byte stream
		const [leading, ...raw_nalus] = sliceNALUs(bytes, { includeLeading: true })
		if (leading.length)
			this.handleError(wrapError('byteStream', new Error(`${leading.length} bytes of leading data in AU`)))
		const nalus: RawNALU[] = []
		for (const raw_nalu of raw_nalus) {
			try {
				nalus.push(parseNALU(raw_nalu))
			} catch (err) {
				this.handleError(wrapError('byteStream', err))
			}
		}

		const messages: SEIExtractedMessage[] = []

		if (this.options.enablePicTiming) {
			// parsing of certain SEIs depends on the active SPS for this AU.
			// because the active SPS is sometimes not known until we reach
			// the first slice NALU, we must do a first pass before actually
			// parsing the SEI
			for (const nalu of nalus) {
				if (nalu.nal_unit_type === NALUType.SPS)
					this.mutePsErrors = false
				try {
					this.psManager.processNALU(nalu)
				} catch (err) {
					this.handleError(wrapError('psManager', err))
				}
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

		const safeProcessMessage = (msg: RawSEIMessage) => {
			try {
				processMessage(msg)
			} catch (err) {
				this.handleError(wrapError('message', err))
			}
		}

		// process SEI NALUs
		for (const nalu of nalus) {
			try {
				if (nalu.nal_unit_type === NALUType.SEI)
					parseSEI(decodeRBSP(nalu.rbsp)).forEach(safeProcessMessage)
			} catch (err) {
				this.handleError(wrapError('nalu', err))
			}
		}

		return messages
	}

	protected derivePicTimingOptions(): PictureTimingParseOptions {
		if (!this.psManager.currentSPS)
			throw new SEIExtractorError('missingPs', 'cannot parse picture timing: no current SPS')
		const options = parsePictureTimingOptionsFromSPS(this.psManager.currentSPS)
		if (this.options.forceCpbDpbDelaysPresent)
			options.CpbDpbDelaysPresentFlag = true
		return options
	}

	/**
	 * handle an error that occurred during parsing. the default implementation
	 * formats an error message and, depending on `options.errors`, throws it
	 * or `console.warn()`s it. the default implementation also silences errors
	 * related to missing SPS/PPS until the first SPS is seen.
	 */
	protected handleError(err: SEIExtractorError): void {
		// mute SPS/PPS related errors until we see the first SPS
		if ((err.context === 'psManager' || err.context === 'missingPs') && this.mutePsErrors)
			return

		const behavior = this.options.errors ?? 'log'

		if (behavior === 'log') {
			console.warn(err.message + ':', err.cause)
		} else if (behavior === 'throw') {
			throw err
		} else {
			throw TypeError(`unknown error behavior ${behavior}`)
		}
	}
}
