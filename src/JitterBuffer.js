//@ts-check
/** This module implements a jitter buffer for 32-bit rolling timestamps */

/** @template T */
class InnerJitterBuffer {
	// TODO: replace with an actual jitterbuffer...
	constructor(/** @type {number} */ firstPts, /** @type {T} */ firstData, /** @type {number} */ queueSize) {
		this.lastPts = firstPts
		this.queue = /** @type {[Number, T][]} */ ([ [firstPts, firstData] ])
		this.queueSize = queueSize
	}

	insert(/** @type {number} */ pts, /** @type {T} */ data) {
		if (((pts - this.lastPts) | 0) <= 0)
			console.error(`PTS not strictly monotonic: had ${this.lastPts}, got ${pts}`)
		this.queue.push( [pts, data] )
		this.lastPts = pts
	}

	/** @returns {T | undefined} */
	retrieve(/** @type {number} */ pts) {
		while (this.queue.length && ((this.queue[0][0] - pts) | 0) < 0)
			this.queue.shift()
		if (this.queue.length && this.queue[0][0] === pts)
			return this.queue[0][1]
	}
}

/** @template T */
export default class JitterBuffer {
	constructor(/** @type {number} */ queueSize, /** @type {number} */ resetThreshold) {
		this.queue = undefined
		this.queueSize = queueSize
		this.resetThreshold = resetThreshold
	}

	insert(/** @type {number} */ pts, /** @type {T} */ data) {
		if (!this.queue || Math.abs((pts - this.queue.lastPts) | 0) > this.resetThreshold) {
			// reinitialize the queue
			if (this.queue) console.warn('reinitializing queue')
			this.queue = /** @type {InnerJitterBuffer<T>} */ new InnerJitterBuffer(pts, data, this.queueSize)
		} else {
			this.queue.insert(pts, data)
		}
	}

	/** @returns {T | undefined} */
	retrieve(/** @type {number} */ pts) {
		return this.queue ? this.queue.retrieve(pts) : undefined
	}
}
