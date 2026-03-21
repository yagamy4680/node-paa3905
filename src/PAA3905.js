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
        await this._delay(0.001); // 1 microsecond
    }

    /**
     * Write a byte to a register with additional delay
     * @param {number} reg - Register address
     * @param {number} value - Value to write
     */
    async writeByteDelay(reg, value) {
        await this.writeByte(reg, value);
        await this._delay(0.011); // 11 microseconds
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
        await this._delay(0.001); // 1 microsecond
        return rxBuffer[1]; // Second byte contains the response
    }

    /**
     * Perform power-up reset
     */
    async reset() {
        await this.writeByte(PAA3905.REGISTERS.POWER_UP_RESET, 0x5A);
        await this._delay(1); // 1ms delay after reset
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
     * Close SPI device (cleanup)
     */
    close() {
        if (this.spi) {
            // io-spi doesn't have explicit close method, but we can set to null
            this.spi = null;
        }
    }
}