/**
 * In addition to environment-independent parsing routines, the library also supplies
 * helpers to aid building a full system that displays received metadata in a
 * synchronized way. Right now these are only targeted at the web, and only at
 * a reduced set of browsers that implement the necessary APIs.
 *
 * This subdirectory hosts said helpers, and more generally everything not strictly
 * dedicated to parsing.
 */

import JitterBuffer from "./JitterBuffer.js"
export { JitterBuffer }
