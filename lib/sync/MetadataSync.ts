/// <reference lib="dom" />

/**
 * Provides {@link MetadataSync} and {@link SimpleMetadataSync}.
 *
 * These are end-to-end helpers which combine {@link sync/RtpScriptTransform} (to
 * extract metadata from the video frames) with {@link sync/JitterBuffer} and
 * {@link sync/RequestFrame.startRvfc} to display it in a synchronized way.
 *
 * @module
 */

import { startRvfc } from "./RequestFrame.js"
import { attachMetadataExtractor, AttachRtpScriptTransformOptions, MessageData, RtpScriptTransformServiceCallback, startMetadataExtractorService } from "./RtpScriptTransform.js"
import JitterBuffer from "./JitterBuffer.js"

type WrappedMeta<Meta> = { ts: number, metadata: Meta }

/**
 * Combines a metadata extractor with a jitter buffer with a metadata extractor,
 * and fetches appropriate metadata as frames are rendered in a `<video>` element.
 *
 * Most use cases should be able to use this helper instead of the individual parts.
 */
export abstract class MetadataSync<TMeta, Meta=unknown, O=unknown> {
	private cleanup?: () => void

	/** stop / deregister */
	public stop() {
		if (!this.cleanup) return
		this.cleanup()
		this.cleanup = undefined
	}

	/** promise resolving when the metadata extractor is ready */
	public readonly ready: Promise<void>

	/** user metadata for the last presented video frame */
	public metadata?: TMeta

	/**
	 * initialize a combined metadata extractor. this builds on top of
	 * {@link sync/RtpScriptTransform.attachMetadataExtractor}, see there for usage.
	 *
	 * the passed worker must call {@link startMetadataSyncService},
	 * NOT {@link sync/RtpScriptTransform.startMetadataExtractorService}.
	 */
	constructor(
		/** negotiated clock rate for the video media (used to derive jitterbuffer parameters) */
		clockRate: number,
		/** `<video>` element playing the video received by `receiver` */
		video: HTMLVideoElement,
		/** RTP receiver handing the played video */
		receiver: RTCRtpReceiver,
		/** see {@link sync/RtpScriptTransform.attachMetadataExtractor} */
		worker: Worker,
		/** see {@link sync/RtpScriptTransform.attachMetadataExtractor} */
		meOptions: AttachRtpScriptTransformOptions<O> = {},
		/** our options */
		options: {
			/** jitter buffer: maximum timestamp offset allowed before jitterbuffer reset [seconds, default = 5] */
			resetTime?: number,
		} = {},
	) {
		this.queue = new JitterBuffer(0, (options.resetTime || 5) * clockRate)

		const receivedMetadata = (meta: WrappedMeta<Meta>) =>
			this.queue.insert(meta.ts, meta.metadata)

		const meCleanup = attachMetadataExtractor(receiver, worker, receivedMetadata, meOptions)
		const rvfcCleanup = startRvfc(video, this.newFrame.bind(this))

		this.cleanup = () => (rvfcCleanup(), meCleanup.then(x => x()))
		this.ready = meCleanup.then(() => {})
	}

	protected queue: JitterBuffer<Meta>

	/**
	 * called by `requestVideoFrameCallback` when the video element presents a new frame.
	 *
	 * the default implementation looks up the new `metadata` from the jitter buffer,
	 * transforms it with {@link transformMetadata} and updates `metadata`.
	 *
	 * this method can be overriden to gather stats.
	 */
	newFrame(_now: number, frameMetadata: VideoFrameCallbackMetadata) {
		const timestamp = frameMetadata.rtpTimestamp
		if (timestamp === undefined)
			throw new Error('RTP timestamp not present; is video playing a WebRTC stream?')
		const metadata = this.queue.retrieve(timestamp)
		this.metadata = metadata ? this.transformMetadata(metadata, timestamp) : undefined
	}

	/**
	 * transform metadata after retrieval from the jitter buffer, if present for the current frame.
	 *
	 * this is a good place to do simple post-processing that would incur extra cost if done
	 * in the worker because of the extra serialization, such as accumulating prior metadata or deltas.
	 */
	abstract transformMetadata(metadata: Meta, timestamp: number): TMeta
}

/** variant of {@link sync/RtpScriptTransform.startMetadataExtractorService} to be paired with {@link MetadataSync} */
export function startMetadataSyncService<Meta=unknown, O=unknown>(
	/** see {@link sync/RtpScriptTransform.startMetadataExtractorService} */
	callback: RtpScriptTransformServiceCallback<O, (frame: RTCEncodedVideoFrame) => (MessageData<Meta> | undefined)>,
	/** see {@link sync/RtpScriptTransform.startMetadataExtractorService} */
	options: Parameters<typeof startMetadataExtractorService<Meta, O>>[1] = {},
): () => void {
	return startMetadataExtractorService<WrappedMeta<Meta>, O>((...args) => {
		const extract = callback(...args)
		return chunk => {
			const frame = chunk as RTCEncodedVideoFrame
			const data = extract(frame)
			if (data) {
				const [ metadata, transfer ] = data
				return [ { ts: frame.timestamp, metadata }, transfer ]
			}
		}
	}, options)
}

/** convenience specialization of MetadataSync that doesn't transform the metadata */
export class SimpleMetadataSync<Meta=unknown, O=unknown> extends MetadataSync<Meta, Meta, O> {
	transformMetadata(metadata: Meta) {
		return metadata
	}
}
