import { PAA3905, LightMode, DetectionMode, AutoMode, Orientation } from './PAA3905.js';

/**
 * PAA3905 Motion Capture class
 * Provides optical flow motion detection (delta X, Y values)
 */
export class PAA3905_MotionCapture extends PAA3905 {
    // Motion-specific registers
    static MOTION_REGISTERS = {
        DELTA_X_L: 0x03,    // Lower byte of X motion delta
        DELTA_X_H: 0x04,    // Upper byte of X motion delta
        DELTA_Y_L: 0x05,    // Lower byte of Y motion delta
        DELTA_Y_H: 0x06,    // Upper byte of Y motion delta
        SQUAL: 0x07,        // Surface quality (0-255)
        SHUTTER_L: 0x0B,    // Lower shutter byte
        SHUTTER_M: 0x0C,    // Middle shutter byte
        SHUTTER_H: 0x0D,    // Upper shutter byte
        MOTION_BURST: 0x16  // Burst mode read command
    };

    /**
     * Constructor for Motion Capture
     * @param {string} device - SPI device path (e.g., '/dev/spidev0.0')
     * @param {string} detectionMode - Standard or enhanced detection
     * @param {string} autoMode - Auto-switching mode for light conditions
     * @param {number} orientation - Orientation flags
     * @param {number} resolution - Resolution setting
     */
    constructor(device, detectionMode = DetectionMode.STANDARD, autoMode = AutoMode.AUTO_01, 
                orientation = Orientation.NORMAL, resolution = 0x2A) {
        super(device, orientation, resolution);
        this.detectionMode = detectionMode;
        this.autoMode = autoMode;
    }

    /**
     * Initialize motion capture mode
     */
    async initMode() {
        // Configure detection mode
        if (this.detectionMode === DetectionMode.ENHANCED) {
            await this.enhancedDetection();
        } else {
            await this.standardDetection();
        }

        // Set auto mode
        const autoModeValue = this.autoMode === AutoMode.AUTO_012 ? 0x01 : 0x00;
        await this.setMode(0x00, autoModeValue);
    }

    /**
     * Apply standard detection mode register configuration
     */
    async standardDetection() {
        // Page 0 registers
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x61, 0xAD);
        await this.writeByteDelay(0x7F, 0x03);
        await this.writeByteDelay(0x40, 0x00);
        await this.writeByteDelay(0x7F, 0x05);
        await this.writeByteDelay(0x41, 0xB3);
        await this.writeByteDelay(0x43, 0xF1);
        await this.writeByteDelay(0x45, 0x14);
        await this.writeByteDelay(0x5B, 0x32);
        await this.writeByteDelay(0x5F, 0x34);
        await this.writeByteDelay(0x7B, 0x08);
        await this.writeByteDelay(0x7F, 0x06);
        await this.writeByteDelay(0x44, 0x1B);
        await this.writeByteDelay(0x40, 0xBF);
        await this.writeByteDelay(0x4E, 0x3F);
        await this.writeByteDelay(0x7F, 0x08);
        await this.writeByteDelay(0x65, 0x20);
        await this.writeByteDelay(0x6A, 0x18);
        await this.writeByteDelay(0x7F, 0x09);
        await this.writeByteDelay(0x4F, 0xAF);
        await this.writeByteDelay(0x5F, 0x40);
        await this.writeByteDelay(0x48, 0x80);
        await this.writeByteDelay(0x49, 0x80);
        await this.writeByteDelay(0x57, 0x77);
        await this.writeByteDelay(0x60, 0x78);
        await this.writeByteDelay(0x61, 0x78);
        await this.writeByteDelay(0x62, 0x08);
        await this.writeByteDelay(0x63, 0x50);
        await this.writeByteDelay(0x7F, 0x0A);
        await this.writeByteDelay(0x45, 0x60);
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x4D, 0x11);
        await this.writeByteDelay(0x55, 0x80);
        await this.writeByteDelay(0x74, 0x1F);
        await this.writeByteDelay(0x75, 0x1F);
        await this.writeByteDelay(0x4A, 0x78);
        await this.writeByteDelay(0x4B, 0x78);
        await this.writeByteDelay(0x44, 0x08);
        await this.writeByteDelay(0x45, 0x50);
        await this.writeByteDelay(0x64, 0xFF);
        await this.writeByteDelay(0x65, 0x1F);
        await this.writeByteDelay(0x7F, 0x14);
        await this.writeByteDelay(0x65, 0x60);
        await this.writeByteDelay(0x66, 0x08);
        await this.writeByteDelay(0x63, 0x70);
        await this.writeByteDelay(0x7F, 0x15);
        await this.writeByteDelay(0x48, 0x48);
        await this.writeByteDelay(0x7F, 0x07);
        await this.writeByteDelay(0x41, 0x0D);
        await this.writeByteDelay(0x43, 0x14);
        await this.writeByteDelay(0x4B, 0x0E);
        await this.writeByteDelay(0x45, 0x0F);
        await this.writeByteDelay(0x44, 0x42);
        await this.writeByteDelay(0x4C, 0x80);
        await this.writeByteDelay(0x7F, 0x10);
        await this.writeByteDelay(0x5B, 0x02);
        await this.writeByteDelay(0x7F, 0x07);
        await this.writeByteDelay(0x40, 0x41);
        await this.writeByteDelay(0x70, 0x00);

        await this._delay(10); // Wait for settings to take effect
        await this.writeByteDelay(0x32, 0x44);
        await this.writeByteDelay(0x7F, 0x07);
        await this.writeByteDelay(0x40, 0x40);
        await this.writeByteDelay(0x7F, 0x06);
        await this.writeByteDelay(0x62, 0xF0);
        await this.writeByteDelay(0x63, 0x00);
        await this.writeByteDelay(0x7F, 0x0D);
        await this.writeByteDelay(0x48, 0xC0);
        await this.writeByteDelay(0x6F, 0xD5);
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x5B, 0xA0);
        await this.writeByteDelay(0x4E, 0xA8);
        await this.writeByteDelay(0x5A, 0x50);
        await this.writeByteDelay(0x40, 0x80);
    }

    /**
     * Apply enhanced detection mode register configuration
     */
    async enhancedDetection() {
        // Page 0 registers
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x61, 0xAD);
        await this.writeByteDelay(0x7F, 0x03);
        await this.writeByteDelay(0x40, 0x00);
        await this.writeByteDelay(0x7F, 0x05);
        await this.writeByteDelay(0x41, 0xB3);
        await this.writeByteDelay(0x43, 0xF1);
        await this.writeByteDelay(0x45, 0x14);
        await this.writeByteDelay(0x5B, 0x32);
        await this.writeByteDelay(0x5F, 0x34);
        await this.writeByteDelay(0x7B, 0x08);
        await this.writeByteDelay(0x7F, 0x06);
        await this.writeByteDelay(0x44, 0x1B);
        await this.writeByteDelay(0x40, 0xBF);
        await this.writeByteDelay(0x4E, 0x3F);
        await this.writeByteDelay(0x7F, 0x08);
        await this.writeByteDelay(0x65, 0x20);
        await this.writeByteDelay(0x6A, 0x18);
        await this.writeByteDelay(0x7F, 0x09);
        await this.writeByteDelay(0x4F, 0xAF);
        await this.writeByteDelay(0x5F, 0x40);
        await this.writeByteDelay(0x48, 0x80);
        await this.writeByteDelay(0x49, 0x80);
        await this.writeByteDelay(0x57, 0x77);
        await this.writeByteDelay(0x60, 0x78);
        await this.writeByteDelay(0x61, 0x78);
        await this.writeByteDelay(0x62, 0x08);
        await this.writeByteDelay(0x63, 0x50);
        await this.writeByteDelay(0x7F, 0x0A);
        await this.writeByteDelay(0x45, 0x60);
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x4D, 0x11);
        await this.writeByteDelay(0x55, 0x80);
        await this.writeByteDelay(0x74, 0x21);
        await this.writeByteDelay(0x75, 0x21);
        await this.writeByteDelay(0x4A, 0x78);
        await this.writeByteDelay(0x4B, 0x78);
        await this.writeByteDelay(0x44, 0x08);
        await this.writeByteDelay(0x45, 0x50);
        await this.writeByteDelay(0x64, 0xCE);
        await this.writeByteDelay(0x65, 0x0B);
        await this.writeByteDelay(0x7F, 0x14);
        await this.writeByteDelay(0x65, 0x60);
        await this.writeByteDelay(0x66, 0x08);
        await this.writeByteDelay(0x63, 0x70);
        await this.writeByteDelay(0x7F, 0x15);
        await this.writeByteDelay(0x48, 0x48);
        await this.writeByteDelay(0x7F, 0x07);
        await this.writeByteDelay(0x41, 0x0D);
        await this.writeByteDelay(0x43, 0x14);
        await this.writeByteDelay(0x4B, 0x0E);
        await this.writeByteDelay(0x45, 0x0F);
        await this.writeByteDelay(0x44, 0x42);
        await this.writeByteDelay(0x4C, 0x80);
        await this.writeByteDelay(0x7F, 0x10);
        await this.writeByteDelay(0x5B, 0x02);
        await this.writeByteDelay(0x7F, 0x07);
        await this.writeByteDelay(0x40, 0x41);
        await this.writeByteDelay(0x70, 0x00);

        await this._delay(10); // Wait for settings to take effect
        await this.writeByteDelay(0x32, 0x44);
        await this.writeByteDelay(0x7F, 0x07);
        await this.writeByteDelay(0x40, 0x40);
        await this.writeByteDelay(0x7F, 0x06);
        await this.writeByteDelay(0x62, 0xF0);
        await this.writeByteDelay(0x63, 0x00);
        await this.writeByteDelay(0x7F, 0x0D);
        await this.writeByteDelay(0x48, 0xC0);
        await this.writeByteDelay(0x6F, 0xD5);
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x5B, 0xA0);
        await this.writeByteDelay(0x4E, 0xA8);
        await this.writeByteDelay(0x5A, 0x50);
        await this.writeByteDelay(0x40, 0x80);
    }

    /**
     * Set detection mode and auto mode
     * @param {number} mode - Detection mode value
     * @param {number} autoMode - Auto mode value
     */
    async setMode(mode, autoMode) {
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x55, 0x80 | (autoMode << 4));
        await this.writeByteDelay(0x50, mode);
    }

    /**
     * Read motion burst data (14 bytes)
     * This reads all motion-related data in one SPI transaction
     */
    async readBurstMode() {
        // Prepare burst read command
        const cmdBuffer = Buffer.from([PAA3905_MotionCapture.MOTION_REGISTERS.MOTION_BURST]);
        const dataBuffer = Buffer.alloc(14);

        try {
            // Send burst command and read 14 bytes in one transaction
            const [result] = await this.spi.transfer([{
                tx_buf: Buffer.concat([cmdBuffer, dataBuffer]),
                delay_usecs: 2
            }]);

            // Extract the 14 data bytes (skip the command echo)
            for (let i = 0; i < 14; i++) {
                this.data[i] = result[i + 1];
            }
        } catch (error) {
            console.error('Burst mode read failed:', error);
            throw error;
        }
    }

    /**
     * Check if motion data is available
     * @returns {boolean} True if motion data is available
     */
    motionDataAvailable() {
        return (this.data[0] & 0x80) !== 0; // Bit 7 of first byte
    }

    /**
     * Check if challenging surface is detected
     * @returns {boolean} True if challenging surface detected
     */
    challengingSurfaceDetected() {
        return (this.data[0] & 0x01) !== 0; // Bit 0 of first byte
    }

    /**
     * Get X motion delta (signed 16-bit)
     * @returns {number} X motion delta
     */
    getDeltaX() {
        const deltaXL = this.data[2];
        const deltaXH = this.data[3];
        let deltaX = (deltaXH << 8) | deltaXL;
        
        // Convert to signed 16-bit
        if (deltaX > 32767) deltaX -= 65536;
        
        // Apply orientation transformation
        if (this.orientation & Orientation.XINVERT) deltaX = -deltaX;
        if (this.orientation & Orientation.SWAP) {
            // Will return Y value instead, but let's handle this in a separate method
        }
        
        return deltaX;
    }

    /**
     * Get Y motion delta (signed 16-bit)
     * @returns {number} Y motion delta
     */
    getDeltaY() {
        const deltaYL = this.data[4];
        const deltaYH = this.data[5];
        let deltaY = (deltaYH << 8) | deltaYL;
        
        // Convert to signed 16-bit
        if (deltaY > 32767) deltaY -= 65536;
        
        // Apply orientation transformation
        if (this.orientation & Orientation.YINVERT) deltaY = -deltaY;
        
        return deltaY;
    }

    /**
     * Get surface quality (0-255, higher is better)
     * @returns {number} Surface quality value
     */
    getSurfaceQuality() {
        return this.data[7]; // Byte 7 contains surface quality
    }

    /**
     * Get raw data sum
     * @returns {number} Raw data sum
     */
    getRawDataSum() {
        return this.data[8];
    }

    /**
     * Get maximum raw data value
     * @returns {number} Maximum raw data value
     */
    getRawDataMax() {
        return this.data[9];
    }

    /**
     * Get minimum raw data value
     * @returns {number} Minimum raw data value
     */
    getRawDataMin() {
        return this.data[10];
    }

    /**
     * Get shutter value (23-bit unsigned)
     * @returns {number} Shutter exposure time
     */
    getShutter() {
        const shutterH = this.data[11];
        const shutterM = this.data[12];
        const shutterL = this.data[13];
        return (shutterH << 16) | (shutterM << 8) | shutterL;
    }

    /**
     * Get current light mode from motion data
     * @returns {string} Current light mode
     */
    getLightMode() {
        const lightModeBits = (this.data[1] >> 6) & 0x03;
        switch (lightModeBits) {
            case 0x00: return LightMode.BRIGHT;
            case 0x01: return LightMode.LOW;
            case 0x02: return LightMode.SUPERLOW;
            default: return LightMode.UNKNOWN;
        }
    }

    /**
     * Get motion information as an object
     * @returns {Object} Motion data object
     */
    getMotionData() {
        return {
            deltaX: this.getDeltaX(),
            deltaY: this.getDeltaY(),
            surfaceQuality: this.getSurfaceQuality(),
            rawDataSum: this.getRawDataSum(),
            rawDataMax: this.getRawDataMax(),
            rawDataMin: this.getRawDataMin(),
            shutter: this.getShutter(),
            lightMode: this.getLightMode(),
            motionAvailable: this.motionDataAvailable(),
            challengingSurface: this.challengingSurfaceDetected()
        };
    }
}