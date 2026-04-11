/**
 * OpticalFlowNative - JavaScript wrapper for the PX4 optical flow native addon
 *
 * Computes pixel-level optical flow between consecutive 35x35 frames
 * captured from the PAA3905 sensor using the PX4 block-matching algorithm.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const addon = require('../build/Release/optical_flow.node');

// Default parameters tuned for PAA3905 35x35 frames
const DEFAULT_OPTIONS = {
    imageWidth: 35,
    imageHeight: 35,
    searchSize: 4,           // Max pixel displacement to search (4 is suitable for 35x35)
    featureThreshold: 30,    // Minimum gradient to consider a block
    valueThreshold: 5000     // Maximum SAD distance to accept a match
};

export class OpticalFlowNative {
    /**
     * @param {Object} [options]
     * @param {number} [options.imageWidth=35]
     * @param {number} [options.imageHeight=35]
     * @param {number} [options.searchSize=4] - Max pixel search range
     * @param {number} [options.featureThreshold=30] - Min gradient for block matching
     * @param {number} [options.valueThreshold=5000] - Max SAD threshold
     */
    constructor(options = {}) {
        this._options = { ...DEFAULT_OPTIONS, ...options };
        this._calculator = new addon.OpticalFlowCalculator(this._options);
    }

    /**
     * Compute optical flow between the previous frame and this frame.
     * On the first call, stores the frame and returns zero flow.
     *
     * @param {Uint8Array} frameData - Raw pixel data (35*35 = 1225 bytes)
     * @returns {{ flowX: number, flowY: number, quality: number }}
     *   - flowX: horizontal pixel displacement (subpixel accuracy)
     *   - flowY: vertical pixel displacement (subpixel accuracy)
     *   - quality: 0-255 confidence score (0 = no flow detected)
     */
    computeFlow(frameData) {
        return this._calculator.computeFlow(frameData);
    }

    /**
     * Reset internal state. Next computeFlow() call will be treated as first frame.
     */
    reset() {
        this._calculator.reset();
    }
}
