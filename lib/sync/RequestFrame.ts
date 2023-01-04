/**
 * @module
 *
 * Helpers for [[requestVideoFrameCallback]] and [[requestAnimationFrame]] that
 * take care of managing handles and coalescing multiple requests.
 */

/** manages a rAF request, ensuring no duplicates or missed handles */
export class RafHandle {
	handle?: number
	constructor(public cb: FrameRequestCallback) {}
	get active() {
		return this.handle !== undefined
	}
	request() {
		if (this.handle !== undefined) return
		this.handle = requestAnimationFrame((...args) => {
			this.handle = undefined
			this.cb(...args)
		})
	}
	cancel() {
		if (this.handle === undefined) return
		cancelAnimationFrame(this.handle)
		this.handle = undefined
	}
}

/** subscribe to video frame callbacks repeatedly. returns stop callback */
export const startRvfc = (video: HTMLVideoElement, callback: VideoFrameRequestCallback) => {
	const wrappedCallback: typeof callback = (...args) => {
		handle = video.requestVideoFrameCallback(wrappedCallback)
		callback(...args)
	}
	let handle = video.requestVideoFrameCallback(wrappedCallback)
	return () => video.cancelVideoFrameCallback(handle)
}
