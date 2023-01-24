/**
 * This module implements a jitter buffer for 32-bit rolling timestamps.
 * It also provides {@link MetadataSync}, which combines it
 * with {@link sync/RtpScriptTransform} and {@link sync/RequestFrame.startRvfc} for convenience.
 *
 * @module
 */

import { startRvfc } from "./RequestFrame.js"
import { attachMetadataExtractor, AttachRtpScriptTransformOptions, MessageData, RtpScriptTransformServiceCallback, startMetadataExtractorService } from "./RtpScriptTransform.js"

class InnerJitterBuffer<T> {
	lastPts: number
	queue: [number, T][]

	// TODO: replace with an actual jitterbuffer...
	constructor(firstPts: number, firstData: T, queueSize: number) {
		this.lastPts = firstPts
		this.queue = [ [firstPts, firstData] ]
	}

	insert(pts: number, data: T) {
		if (((pts - this.lastPts) | 0) <= 0)
			console.error(`PTS not strictly monotonic: had ${this.lastPts}, got ${pts}`)
		this.queue.push( [pts, data] )
		this.lastPts = pts
	}

	retrieve(pts: number): T | undefined {
		while (this.queue.length && ((this.queue[0][0] - pts) | 0) < 0)
			this.queue.shift()
		if (this.queue.length && this.queue[0][0] === pts)
			return this.queue[0][1]
	}
}

/**
 * Very simple jitter buffer.
 *
 * Actually not really a jitter buffer, but should be enough to synchronize
 * from a WebRTC Encoded Stream to presentation.
 */
export default class JitterBuffer<T> {
	private queue?: InnerJitterBuffer<T>
	constructor(public queueSize: number, public resetThreshold: number) {}

	insert(pts: number, data: T) {
		if (!this.queue || Math.abs((pts - this.queue.lastPts) | 0) > this.resetThreshold) {
			// reinitialize the queue
			if (this.queue) console.warn('reinitializing queue')
			this.queue = /** @type {InnerJitterBuffer<T>} */ new InnerJitterBuffer(pts, data, this.queueSize)
		} else {
			this.queue.insert(pts, data)
		}
	}

	retrieve(pts: number): T | undefined {
		return this.queue ? this.queue.retrieve(pts) : undefined
	}
}

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
	newFrame(now: number, frameMetadata: VideoFrameCallbackMetadata) {
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
