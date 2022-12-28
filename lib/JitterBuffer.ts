/** This module implements a jitter buffer for 32-bit rolling timestamps */

class InnerJitterBuffer<T> {
	lastPts: number
	queue: [number, T][]

	// TODO: replace with an actual jitterbuffer...
	constructor(firstPts: number, firstData: T, _queueSize: number) {
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
