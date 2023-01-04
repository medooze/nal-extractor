/**
 * Helpers to manage the resolution of canvas elements.
 *
 * @module
 */

/**
 * subscribe to changes in `window.devicePixelRatio`.
 *
 * @returns stop / deregister callback
 */
export function monitorDevicePixelRatio(cb: () => void): () => void {
	let clean: () => void
	let register = () => {
		const media = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
		if (!media.matches) throw Error('this... should not happen')
		const listener = () => (register(), cb())
		media.addEventListener('change', listener, { once: true })
		clean = () => media.removeEventListener('change', listener)
	}
	register()
	return () => clean()
}

/**
 * subscribe to changes in the natural resolution of an on-screen element (usually a `<canvas>`).
 *
 * put another way, `cb` is called whenever {@link getNaturalResolution} would return a different value.
 * under the hood, this combines {@link monitorDevicePixelRatio} with a `ResizeObserver`.
 *
 * @returns stop / deregister callback
 */
export function monitorNaturalResolution(target: Element, cb: () => void): () => void {
	const cleanDPP = monitorDevicePixelRatio(cb)
	const observer = new ResizeObserver(cb)
	observer.observe(target)
	return () => (cleanDPP(), observer.disconnect())
}

/**
 * get the natural resolution of an element (usually a `<canvas>`), i.e. its size in native screen pixels.
 *
 * under the hood, this combines `clientWidth` / `clientHeight` with `devicePixelRatio`.
 */
export const getNaturalResolution = (target: Element): [number, number] =>
	[
		target.clientWidth * window.devicePixelRatio,
		target.clientHeight * window.devicePixelRatio,
	]

/** applies the passed resolution to the canvas, by setting `width` / `height` if different */
export function applyCanvasResolution(canvas: HTMLCanvasElement, resolution: [number, number]) {
	if (canvas.width !== resolution[0])
		canvas.width = resolution[0]
	if (canvas.height !== resolution[1])
		canvas.height = resolution[1]
}

/** equivalent to `applyCanvasResolution(canvas, getNaturalResolution(canvas))` */
export const matchCanvasResolution = (canvas: HTMLCanvasElement) =>
	applyCanvasResolution(canvas, getNaturalResolution(canvas))
