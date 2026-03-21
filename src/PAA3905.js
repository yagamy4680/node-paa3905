import SPIDevice from '@eeemarv/io-spi';

/**
 * Light mode enumeration
 */
export const LightMode = {
    BRIGHT: 'bright',      // >60 lux
    LOW: 'low',           // >30 lux
    SUPERLOW: 'superlow', // >5 lux
    UNKNOWN: 'unknown'
};

/**
 * Detection sensitivity modes
 */
export const DetectionMode = {
    STANDARD: 'standard',   // Default mode
    ENHANCED: 'enhanced'    // For rough terrain at >15cm height
};

/**
 * Auto-switching modes between light conditions
 */
export const AutoMode = {
    AUTO_01: 'auto_01',   // Switches between bright and low light
    AUTO_012: 'auto_012' // Switches between bright, low, and super-low light
};

/**
 * Sensor orientation transformations
 */
export const Orientation = {
    NORMAL: 0x00,
    XINVERT: 0x80,  // Invert X axis
    YINVERT: 0x40,  // Invert Y axis
    SWAP: 0x20      // Swap X and Y
};

/**
 * Base class for PAA3905 optical flow sensor
 * Provides core SPI communication and register management
 */
export class PAA3905 {
    // Register definitions
    static REGISTERS = {
        FORWARD_PRODUCT_ID: 0x00,  // Read: 0xA2 (byte 0)
        MOTION: 0x02,              // Motion register
        POWER_UP_RESET: 0x3A,      // Write: 0x5A for reset
        SHUTDOWN: 0x3B,            // Write: 0xB6 for shutdown
        RESOLUTION: 0x4E,          // Sets resolution (0x00-0xFF)
        ORIENTATION: 0x5B,         // Sets orientation
        INVERSE_PRODUCT_ID: 0x5F   // Read: 0x5D (inverse check)
    };

    // SPI settings - try multiple configurations for compatibility
    static SPI_CONFIGS = [
        // { max_speed_hz: 2000000, mode: 3, bits_per_word: 8 }, // Preferred: SPI Mode 3
        { max_speed_hz: 2000000, mode: 0, bits_per_word: 8 }, // Fallback: SPI Mode 0
        { max_speed_hz: 1000000, mode: 3, bits_per_word: 8 }, // Slower Mode 3
        { max_speed_hz: 1000000, mode: 0, bits_per_word: 8 }, // Slower Mode 0
        { max_speed_hz: 500000, mode: 0, bits_per_word: 8 }   // Conservative
    ];

    // Data validation thresholds for different light modes
    static THRESHOLDS = {
        [LightMode.BRIGHT]: { quality: 25, shutter: 0x00FF80 },
        [LightMode.LOW]: { quality: 70, shutter: 0x00FF80 },
        [LightMode.SUPERLOW]: { quality: 85, shutter: 0x025998 }
    };

    /**
     * Constructor for PAA3905 base class
     * @param {string} device - SPI device path (e.g., '/dev/spidev0.0')
     * @param {number} orientation - Orientation flags (combination of Orientation constants)
     * @param {number} resolution - Resolution setting (0x00-0xFF)
     */
    constructor(device, orientation = Orientation.NORMAL, resolution = 0x2A) {
        this.device = device;
        this.orientation = orientation;
        this.resolution = resolution;
        this.spi = null;
        this.currentConfig = null;
        this.data = new Array(14).fill(0); // Motion burst data buffer
    }

    /**
     * Initialize the SPI device and verify sensor connection
     * @returns {Promise<boolean>} Success status
     */
    async begin() {
        let lastError = null;
        
        // Try different SPI configurations for compatibility
        for (let i = 0; i < PAA3905.SPI_CONFIGS.length; i++) {
            const config = PAA3905.SPI_CONFIGS[i];
            try {
                console.log(`Trying SPI config ${i + 1}/${PAA3905.SPI_CONFIGS.length}: Mode ${config.mode}, Speed ${config.max_speed_hz/1000}kHz (${this.device})`);
                
                // Initialize SPI device with current configuration
                this.spi = new SPIDevice(this.device, config);
                this.currentConfig = config;

                // Perform power-up reset
                await this.reset();

                // Wait for sensor to be ready
                await this._delay(50);

                // Verify product ID
                const productId = await this.readByte(PAA3905.REGISTERS.FORWARD_PRODUCT_ID);
                const inverseProductId = await this.readByte(PAA3905.REGISTERS.INVERSE_PRODUCT_ID);

                if (productId !== 0xA2 || inverseProductId !== 0x5D) {
                    console.log(`Product ID check failed with config ${i + 1}: ${productId.toString(16)}, ${inverseProductId.toString(16)}`);
                    // Try next configuration
                    this.spi = null;
                    continue;
                }

                console.log(`✅ Success with SPI Mode ${config.mode}, Speed ${config.max_speed_hz/1000}kHz`);

                // Set initial configuration
                await this.setResolution(this.resolution);
                await this.setOrientation(this.orientation);

                // Initialize mode-specific configuration (implemented in subclasses)
                await this.initMode();

                return true;
                
            } catch (error) {
                lastError = error;
                console.log(`Config ${i + 1} failed: ${error.message}`);
                console.dir(error);
                this.spi = null;
                // Continue to next configuration
            }
        }
        
        // All configurations failed
        console.error('All SPI configurations failed. Last error:', lastError?.message);
        return false;
    }

    /**
     * Abstract method to be implemented by subclasses
     * @throws {Error} If not implemented
     */
    async initMode() {
        throw new Error('initMode() must be implemented by subclass');
    }

    async setMode(mode, autoMode) {
        // reset();
        switch(mode) {
            case DetectionMode.STANDARD: // standard detection
                await this.standardDetection();
                break;

            case DetectionMode.ENHANCED: // enhanced detection
                await this.enhancedDetection();
                break;
            
            default:
                throw new Error(`Unknown detection mode: ${mode}`);
        }

        if (autoMode == AutoMode.AUTO_012){
            await this.writeByteDelay(0x7F, 0x08);
            await this.writeByteDelay(0x68, 0x02);
            await this.writeByteDelay(0x7F, 0x00);
        }
        else
        {
            await this.writeByteDelay(0x7F, 0x08);
            await this.writeByteDelay(0x68, 0x01);
            await this.writeByteDelay(0x7F, 0x00);
        }
    }

    /**
     * Write a byte to a register
     * @param {number} reg - Register address
     * @param {number} value - Value to write
     */
    async writeByte(reg, value) {
        const txBuffer = Buffer.from([reg | 0x80, value]); // MSB = 1 for write
        await this.spi.transfer([{
            tx_buf: txBuffer,
            delay_usecs: 1
        }]);
    }

    /**
     * Write a byte to a register with additional delay
     * @param {number} reg - Register address
     * @param {number} value - Value to write
     */
    async writeByteDelay(reg, value) {
        await this.writeByte(reg, value);
        this.wait_microseconds(11); // 11 microsecond delay after write
    }

    /**
     * Read a byte from a register
     * @param {number} reg - Register address
     * @returns {Promise<number>} Register value
     */
    async readByte(reg) {
        const txBuffer = Buffer.from([reg & 0x7F, 0x00]); // MSB = 0 for read
        const [rxBuffer] = await this.spi.transfer([{
            tx_buf: txBuffer,
            delay_usecs: 2
        }]);
        this.wait_microseconds(1); // 1 microsecond delay after read
        return rxBuffer[1]; // Second byte contains the response
    }

    /**
     * Perform power-up reset
     */
    async reset() {
        await this.writeByte(PAA3905.REGISTERS.POWER_UP_RESET, 0x5A);
        console.log('Sensor reset command sent, waiting for sensor to reboot...');
        await this._delay(1000); // 1s delay after reset
        for (let i = 0; i < 5; i++) {
            await this.readByte(PAA3905.REGISTERS.MOTION + i); // Clear motion burst data
            this.wait_microseconds(2); // 2 microseconds between reads
        }
    }

    /**
     * Enter shutdown mode
     */
    async shutdown() {
        await this.writeByte(PAA3905.REGISTERS.SHUTDOWN, 0xB6);
    }

    /**
     * Set resolution
     * @param {number} res - Resolution value (0x00-0xFF)
     */
    async setResolution(res) {
        this.resolution = res;
        await this.writeByte(PAA3905.REGISTERS.RESOLUTION, res);
    }

    /**
     * Set orientation
     * @param {number} orient - Orientation flags
     */
    async setOrientation(orient) {
        this.orientation = orient;
        await this.writeByte(PAA3905.REGISTERS.ORIENTATION, orient);
    }

    /**
     * Get current resolution in CPM (Counts Per Meter)
     * @returns {number} Resolution in CPM
     */
    getResolution() {
        return (this.resolution + 1) * 20;
    }

    /**
     * Get current SPI configuration
     * @returns {Object} Current SPI configuration
     */
    getCurrentSpiConfig() {
        return this.currentConfig || null;
    }

    /**
     * Validate data quality based on thresholds
     * @param {string} lightMode - Current light mode
     * @param {number} surfaceQuality - Surface quality value (0-255)
     * @param {number} shutter - Shutter value
     * @returns {boolean} True if data is above quality thresholds
     */
    dataAboveThresholds(lightMode, surfaceQuality, shutter) {
        const thresholds = PAA3905.THRESHOLDS[lightMode];
        if (!thresholds) return false;
        
        return surfaceQuality >= thresholds.quality && shutter < thresholds.shutter;
    }

    /**
     * Utility function for delays
     * @param {number} ms - Delay in milliseconds
     */
    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Busy-loop to wait in microseconds
     * @param {number} us - Delay in microseconds
     */
    wait_microseconds(us) {
        const start = process.hrtime();
        let end;
        do {
            end = process.hrtime(start);
            // end[0] is seconds, end[1] is nanoseconds
            // 1000 nanoseconds = 1 microsecond
        } while (end[0] * 1e9 + end[1] < us * 1000);
    }

    /**
     * Close SPI device (cleanup)
     */
    close() {
        if (this.spi) {
            // io-spi doesn't have explicit close method, but we can set to null
            this.spi = null;
        }
    }

    // // Performance optimization registers for the three different modes
    async standardDetection() {
        await this.writeByteDelay(0x7F, 0x00); // 1
        await this.writeByteDelay(0x51, 0xFF);
        await this.writeByteDelay(0x4E, 0x2A);
        await this.writeByteDelay(0x66, 0x3E);
        await this.writeByteDelay(0x7F, 0x14);
        await this.writeByteDelay(0x7E, 0x71);
        await this.writeByteDelay(0x55, 0x00);
        await this.writeByteDelay(0x59, 0x00);
        await this.writeByteDelay(0x6F, 0x2C);
        await this.writeByteDelay(0x7F, 0x05); // 10
        
        await this.writeByteDelay(0x4D, 0xAC); // 11
        await this.writeByteDelay(0x4E, 0x32);
        await this.writeByteDelay(0x7F, 0x09);
        await this.writeByteDelay(0x5C, 0xAF);
        await this.writeByteDelay(0x5F, 0xAF);
        await this.writeByteDelay(0x70, 0x08);
        await this.writeByteDelay(0x71, 0x04);
        await this.writeByteDelay(0x72, 0x06);
        await this.writeByteDelay(0x74, 0x3C);
        await this.writeByteDelay(0x75, 0x28); // 20
        
        await this.writeByteDelay(0x76, 0x20); //  21
        await this.writeByteDelay(0x4E, 0xBF);
        await this.writeByteDelay(0x7F, 0x03);
        await this.writeByteDelay(0x64, 0x14);
        await this.writeByteDelay(0x65, 0x0A);
        await this.writeByteDelay(0x66, 0x10);
        await this.writeByteDelay(0x55, 0x3C);
        await this.writeByteDelay(0x56, 0x28);
        await this.writeByteDelay(0x57, 0x20);
        await this.writeByteDelay(0x4A, 0x2D); // 30
        
        await this.writeByteDelay(0x4B, 0x2D); // 31
        await this.writeByteDelay(0x4E, 0x4B);
        await this.writeByteDelay(0x69, 0xFA);
        await this.writeByteDelay(0x7F, 0x05);
        await this.writeByteDelay(0x69, 0x1F);
        await this.writeByteDelay(0x47, 0x1F);
        await this.writeByteDelay(0x48, 0x0C);
        await this.writeByteDelay(0x5A, 0x20);
        await this.writeByteDelay(0x75, 0x0F);
        await this.writeByteDelay(0x4A, 0x0F);  // 40
        
        await this.writeByteDelay(0x42, 0x02);  // 41
        await this.writeByteDelay(0x45, 0x03);
        await this.writeByteDelay(0x65, 0x00);
        await this.writeByteDelay(0x67, 0x76);
        await this.writeByteDelay(0x68, 0x76);
        await this.writeByteDelay(0x6A, 0xC5);
        await this.writeByteDelay(0x43, 0x00);
        await this.writeByteDelay(0x7F, 0x06);
        await this.writeByteDelay(0x4A, 0x18);
        await this.writeByteDelay(0x4B, 0x0C); // 50
        
        await this.writeByteDelay(0x4C, 0x0C); // 51 
        await this.writeByteDelay(0x4D, 0x0C);  
        await this.writeByteDelay(0x46, 0x0A);
        await this.writeByteDelay(0x59, 0xCD);
        await this.writeByteDelay(0x7F, 0x0A);
        await this.writeByteDelay(0x4A, 0x2A);
        await this.writeByteDelay(0x48, 0x96);
        await this.writeByteDelay(0x52, 0xB4);
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x5B, 0xA0); // 60
    }

    async enhancedDetection() {
        await this.writeByteDelay(0x7F, 0x00); // 1
        await this.writeByteDelay(0x51, 0xFF);
        await this.writeByteDelay(0x4E, 0x2A);
        await this.writeByteDelay(0x66, 0x26);
        await this.writeByteDelay(0x7F, 0x14);
        await this.writeByteDelay(0x7E, 0x71);
        await this.writeByteDelay(0x55, 0x00);
        await this.writeByteDelay(0x59, 0x00);
        await this.writeByteDelay(0x6F, 0x2C);
        await this.writeByteDelay(0x7F, 0x05); // 10
        
        await this.writeByteDelay(0x4D, 0xAC); // 11
        await this.writeByteDelay(0x4E, 0x65);
        await this.writeByteDelay(0x7F, 0x09);
        await this.writeByteDelay(0x5C, 0xAF);
        await this.writeByteDelay(0x5F, 0xAF);
        await this.writeByteDelay(0x70, 0x00);
        await this.writeByteDelay(0x71, 0x00);
        await this.writeByteDelay(0x72, 0x00);
        await this.writeByteDelay(0x74, 0x14);
        await this.writeByteDelay(0x75, 0x14); // 20
        
        await this.writeByteDelay(0x76, 0x06); //  21
        await this.writeByteDelay(0x4E, 0x8F);
        await this.writeByteDelay(0x7F, 0x03);
        await this.writeByteDelay(0x64, 0x00);
        await this.writeByteDelay(0x65, 0x00);
        await this.writeByteDelay(0x66, 0x00);
        await this.writeByteDelay(0x55, 0x14);
        await this.writeByteDelay(0x56, 0x14);
        await this.writeByteDelay(0x57, 0x06);
        await this.writeByteDelay(0x4A, 0x20); // 30
        
        await this.writeByteDelay(0x4B, 0x20); // 31
        await this.writeByteDelay(0x4E, 0x32);
        await this.writeByteDelay(0x69, 0xFE);
        await this.writeByteDelay(0x7F, 0x05);
        await this.writeByteDelay(0x69, 0x14);
        await this.writeByteDelay(0x47, 0x14);
        await this.writeByteDelay(0x48, 0x1C);
        await this.writeByteDelay(0x5A, 0x20);
        await this.writeByteDelay(0x75, 0xE5);
        await this.writeByteDelay(0x4A, 0x05);  // 40

        await this.writeByteDelay(0x42, 0x04);  // 41
        await this.writeByteDelay(0x45, 0x03);
        await this.writeByteDelay(0x65, 0x00);
        await this.writeByteDelay(0x67, 0x50);
        await this.writeByteDelay(0x68, 0x50);
        await this.writeByteDelay(0x6A, 0xC5);
        await this.writeByteDelay(0x43, 0x00);
        await this.writeByteDelay(0x7F, 0x06);
        await this.writeByteDelay(0x4A, 0x1E);
        await this.writeByteDelay(0x4B, 0x1E); // 50
        
        await this.writeByteDelay(0x4C, 0x34); // 51 
        await this.writeByteDelay(0x4D, 0x34);  
        await this.writeByteDelay(0x46, 0x32);
        await this.writeByteDelay(0x59, 0x0D);
        await this.writeByteDelay(0x7F, 0x0A);
        await this.writeByteDelay(0x4A, 0x2A);
        await this.writeByteDelay(0x48, 0x96);
        await this.writeByteDelay(0x52, 0xB4);
        await this.writeByteDelay(0x7F, 0x00);
        await this.writeByteDelay(0x5B, 0xA0); // 60
    }

}
