/**
 * PAA3905 Node.js Library
 * JavaScript/Node.js port of the Arduino PAA3905 optical flow sensor library
 * 
 * Based on the original Arduino library by Simon D. Levy
 * https://github.com/simondlevy/PAA3905
 * 
 * Ported to use @eeemarv/io-spi for SPI communication in Node.js
 */

// Export base class and constants
export { 
    PAA3905, 
    LightMode, 
    DetectionMode, 
    AutoMode, 
    Orientation 
} from './PAA3905.js';

// Export motion capture class
export { PAA3905_MotionCapture } from './PAA3905_MotionCapture.js';

// Export frame capture class
export { PAA3905_FrameCapture } from './PAA3905_FrameCapture.js';

// Define version
export const version = '1.0.0';

// Export helper function for creating motion capture instances
export function createMotionCapture(device, options = {}) {
    const {
        detectionMode = DetectionMode.STANDARD,
        autoMode = AutoMode.AUTO_01,
        orientation = Orientation.NORMAL,
        resolution = 0x2A
    } = options;
    
    return new PAA3905_MotionCapture(device, detectionMode, autoMode, orientation, resolution);
}

// Export helper function for creating frame capture instances
export function createFrameCapture(device, options = {}) {
    const {
        orientation = Orientation.NORMAL,
        resolution = 0x2A
    } = options;
    
    return new PAA3905_FrameCapture(device, orientation, resolution);
}