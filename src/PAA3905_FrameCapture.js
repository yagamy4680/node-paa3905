import { PAA3905, Orientation } from './PAA3905.js';

/**
 * PAA3905 Frame Capture class
 * Provides raw image capture functionality (35x35 pixels)
 */
export class PAA3905_FrameCapture extends PAA3905 {
    // Frame capture specific registers
    static FRAME_REGISTERS = {
        RAWDATA_SUM: 0x08,         // Sum of raw data
        MAX_RAWDATA: 0x09,         // Maximum raw data value
        MIN_RAWDATA: 0x0A,         // Minimum raw data value
        RAWDATA_GRAB_STATUS: 0x10, // Status register for frame grab
        RAWDATA_GRAB: 0x13         // Raw data grab register
    };

    // Frame dimensions
    static FRAME_WIDTH = 35;
    static FRAME_HEIGHT = 35;
    static FRAME_SIZE = 35 * 35; // 1225 pixels

    /**
     * Constructor for Frame Capture
     * @param {string} device - SPI device path (e.g., '/dev/spidev0.0')
     * @param {number} orientation - Orientation flags
     * @param {number} resolution - Resolution setting
     */
    constructor(device, orientation = Orientation.NORMAL, resolution = 0x2A) {
        super(device, orientation, resolution);
        this.frameBuffer = new Uint8Array(PAA3905_FrameCapture.FRAME_SIZE);
    }

    /**
     * Initialize frame capture mode
     */
    async initMode() {
        // Frame capture mode initialization
        await this.writeByteDelay(0x7F, 0x07);
        await this.writeByteDelay(0x41, 0x1D);
        await this.writeByteDelay(0x43, 0x00);
        await this.writeByteDelay(0x4B, 0x00);
        await this.writeByteDelay(0x45, 0x6F);
        await this.writeByteDelay(0x44, 0x42);
        await this.writeByteDelay(0x4C, 0x80);
        await this.writeByteDelay(0x7F, 0x08);
        await this.writeByteDelay(0x6A, 0x38);
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x55, 0x04);
        await this.writeByteDelay(0x50, 0x07);
        await this.writeByteDelay(0x7F, 0x14);
        await this.writeByteDelay(0x65, 0x60);
        await this.writeByteDelay(0x66, 0x08);
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x48, 0xFF);
    }

    /**
     * Check if frame data is ready for capture
     * @returns {Promise<boolean>} True if frame is ready
     */
    async frameReady() {
        const status = await this.readByte(PAA3905_FrameCapture.FRAME_REGISTERS.RAWDATA_GRAB_STATUS);
        return (status & 0x40) !== 0;
    }

    /**
     * Wait for frame to be ready
     * @param {number} timeoutMs - Timeout in milliseconds (default: 1000)
     * @returns {Promise<boolean>} True if frame became ready within timeout
     */
    async waitForFrame(timeoutMs = 1000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            if (await this.frameReady()) {
                return true;
            }
            await this._delay(1); // Wait 1ms between checks
        }
        return false;
    }

    /**
     * Capture a single frame (35x35 pixels)
     * @param {Uint8Array} [targetArray] - Optional target array to store frame data
     * @returns {Promise<Uint8Array>} Frame data as Uint8Array
     */
    async captureFrame(targetArray = null) {
        const frameArray = targetArray || new Uint8Array(PAA3905_FrameCapture.FRAME_SIZE);
        
        if (frameArray.length < PAA3905_FrameCapture.FRAME_SIZE) {
            throw new Error(`Target array too small. Expected ${PAA3905_FrameCapture.FRAME_SIZE}, got ${frameArray.length}`);
        }

        try {
            // Wait for frame to be ready
            if (!(await this.waitForFrame())) {
                throw new Error('Timeout waiting for frame to be ready');
            }

            // Start frame capture by reading the first pixel
            await this.readByte(PAA3905_FrameCapture.FRAME_REGISTERS.RAWDATA_GRAB);

            // Read all pixels sequentially
            for (let i = 0; i < PAA3905_FrameCapture.FRAME_SIZE; i++) {
                frameArray[i] = await this.readByte(PAA3905_FrameCapture.FRAME_REGISTERS.RAWDATA_GRAB);
                
                // Small delay between pixel reads for stability
                if (i % 35 === 0 && i > 0) {
                    await this._delay(0.01); // 10 microseconds every row
                }
            }

            // Apply orientation transformations if needed
            this._applyOrientation(frameArray);

            return frameArray;
        } catch (error) {
            console.error('Frame capture failed:', error);
            throw error;
        }
    }

    /**
     * Capture frame with statistics
     * @returns {Promise<Object>} Frame data with statistics
     */
    async captureFrameWithStats() {
        const frameData = await this.captureFrame();
        
        // Calculate statistics
        let sum = 0;
        let min = 255;
        let max = 0;

        for (let i = 0; i < frameData.length; i++) {
            const pixel = frameData[i];
            sum += pixel;
            if (pixel < min) min = pixel;
            if (pixel > max) max = pixel;
        }

        const average = sum / frameData.length;

        return {
            frameData,
            width: PAA3905_FrameCapture.FRAME_WIDTH,
            height: PAA3905_FrameCapture.FRAME_HEIGHT,
            statistics: {
                sum,
                min,
                max,
                average: Math.round(average * 100) / 100
            }
        };
    }

    /**
     * Apply orientation transformations to frame data
     * @param {Uint8Array} frameArray - Frame data to transform
     */
    _applyOrientation(frameArray) {
        const width = PAA3905_FrameCapture.FRAME_WIDTH;
        const height = PAA3905_FrameCapture.FRAME_HEIGHT;

        // Create a copy for transformations
        const originalFrame = new Uint8Array(frameArray);

        if (this.orientation & Orientation.SWAP) {
            // Swap X and Y (transpose)
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    frameArray[col * width + row] = originalFrame[row * width + col];
                }
            }
            // Update the original for further transformations
            originalFrame.set(frameArray);
        }

        if (this.orientation & Orientation.XINVERT) {
            // Invert X axis (horizontal flip)
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    frameArray[row * width + col] = originalFrame[row * width + (width - 1 - col)];
                }
            }
            originalFrame.set(frameArray);
        }

        if (this.orientation & Orientation.YINVERT) {
            // Invert Y axis (vertical flip)
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    frameArray[row * width + col] = originalFrame[(height - 1 - row) * width + col];
                }
            }
        }
    }

    /**
     * Get pixel value at specific coordinates
     * @param {Uint8Array} frameArray - Frame data
     * @param {number} x - X coordinate (0-34)
     * @param {number} y - Y coordinate (0-34)
     * @returns {number} Pixel value (0-255)
     */
    static getPixel(frameArray, x, y) {
        if (x < 0 || x >= PAA3905_FrameCapture.FRAME_WIDTH || 
            y < 0 || y >= PAA3905_FrameCapture.FRAME_HEIGHT) {
            throw new Error(`Coordinates out of bounds: (${x}, ${y})`);
        }
        return frameArray[y * PAA3905_FrameCapture.FRAME_WIDTH + x];
    }

    /**
     * Set pixel value at specific coordinates
     * @param {Uint8Array} frameArray - Frame data
     * @param {number} x - X coordinate (0-34)
     * @param {number} y - Y coordinate (0-34)
     * @param {number} value - Pixel value (0-255)
     */
    static setPixel(frameArray, x, y, value) {
        if (x < 0 || x >= PAA3905_FrameCapture.FRAME_WIDTH || 
            y < 0 || y >= PAA3905_FrameCapture.FRAME_HEIGHT) {
            throw new Error(`Coordinates out of bounds: (${x}, ${y})`);
        }
        frameArray[y * PAA3905_FrameCapture.FRAME_WIDTH + x] = value & 0xFF;
    }

    /**
     * Convert frame to ASCII art for debugging/visualization
     * @param {Uint8Array} frameArray - Frame data
     * @param {number} threshold - Threshold for binary conversion (default: 128)
     * @returns {string} ASCII representation of frame
     */
    static frameToASCII(frameArray, threshold = 128) {
        let ascii = '';
        const chars = ' .:-=+*#%@';
        
        for (let row = 0; row < PAA3905_FrameCapture.FRAME_HEIGHT; row++) {
            for (let col = 0; col < PAA3905_FrameCapture.FRAME_WIDTH; col++) {
                const pixel = frameArray[row * PAA3905_FrameCapture.FRAME_WIDTH + col];
                const charIndex = Math.floor((pixel / 255) * (chars.length - 1));
                ascii += chars[charIndex];
            }
            ascii += '\n';
        }
        return ascii;
    }

    /**
     * Convert frame to simple bitmap representation
     * @param {Uint8Array} frameArray - Frame data
     * @param {number} threshold - Threshold for binary conversion (default: 128)
     * @returns {string} Bitmap representation using '█' and ' '
     */
    static frameToBitmap(frameArray, threshold = 128) {
        let bitmap = '';
        for (let row = 0; row < PAA3905_FrameCapture.FRAME_HEIGHT; row++) {
            for (let col = 0; col < PAA3905_FrameCapture.FRAME_WIDTH; col++) {
                const pixel = frameArray[row * PAA3905_FrameCapture.FRAME_WIDTH + col];
                bitmap += pixel > threshold ? '█' : ' ';
            }
            bitmap += '\n';
        }
        return bitmap;
    }

    /**
     * Get the current frame buffer
     * @returns {Uint8Array} Current frame buffer
     */
    getFrameBuffer() {
        return this.frameBuffer;
    }
}