/**
 * PAA3905 Demo Example
 * Demonstrates both motion capture and frame capture functionality
 */

import { 
    PAA3905_MotionCapture, 
    PAA3905_FrameCapture, 
    DetectionMode, 
    AutoMode, 
    Orientation 
} from './src/index.js';

// Configuration
const SPI_DEVICE = '/dev/spidev0.0';  // Adjust for your system

/**
 * Demo 1: Motion Detection
 */
async function motionDemo() {
    console.log('🚀 === Motion Detection Demo ===\n');
    
    const sensor = new PAA3905_MotionCapture(
        SPI_DEVICE,
        DetectionMode.STANDARD,
        AutoMode.AUTO_01,
        Orientation.NORMAL,
        0x2A
    );
    
    try {
        console.log('Initializing motion sensor...');
        if (!(await sensor.begin())) {
            throw new Error('Motion sensor initialization failed');
        }
        
        console.log('✅ Motion sensor ready!');
        console.log('📏 Resolution:', sensor.getResolution(), 'CPM');
        console.log('👋 Move something under the sensor...\n');
        
        // Sample motion for 5 seconds
        let motionDetected = false;
        const startTime = Date.now();
        
        while (Date.now() - startTime < 5000) {
            await sensor.readBurstMode();
            
            if (sensor.motionDataAvailable()) {
                const motion = sensor.getMotionData();
                
                if (motion.deltaX !== 0 || motion.deltaY !== 0) {
                    motionDetected = true;
                    console.log(`📍 Motion: ΔX=${motion.deltaX}, ΔY=${motion.deltaY}, Quality=${motion.surfaceQuality}`);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 50)); // 20 Hz
        }
        
        if (motionDetected) {
            console.log('✅ Motion detection working correctly!\n');
        } else {
            console.log('⚠️  No motion detected - try moving an object under the sensor\n');
        }
        
    } finally {
        sensor.close();
    }
}

/**
 * Demo 2: Image Capture
 */
async function imageDemo() {
    console.log('📷 === Image Capture Demo ===\n');
    
    const camera = new PAA3905_FrameCapture(
        SPI_DEVICE,
        Orientation.NORMAL,
        0x2A
    );
    
    try {
        console.log('Initializing image sensor...');
        if (!(await camera.begin())) {
            throw new Error('Image sensor initialization failed');
        }
        
        console.log('✅ Image sensor ready!');
        console.log('📸 Capturing infrared image...\n');
        
        const result = await camera.captureFrameWithStats();
        
        console.log(`🖼️  Captured ${result.width}×${result.height} pixel image`);
        console.log(`📊 Statistics:`);
        console.log(`   Min pixel: ${result.statistics.min}`);
        console.log(`   Max pixel: ${result.statistics.max}`);
        console.log(`   Average: ${result.statistics.average}`);
        console.log(`   Dynamic range: ${result.statistics.max - result.statistics.min}\n`);
        
        // Display image as ASCII art
        console.log('🎨 ASCII representation:');
        const ascii = PAA3905_FrameCapture.frameToASCII(result.frameData);
        console.log(ascii);
        
        // Display binary representation
        console.log('🔲 Binary representation (threshold: 128):');
        const bitmap = PAA3905_FrameCapture.frameToBitmap(result.frameData, 128);
        console.log(bitmap);
        
        // Show center pixel info
        const centerPixel = PAA3905_FrameCapture.getPixel(result.frameData, 17, 17);
        console.log(`🎯 Center pixel (17,17): ${centerPixel}\n`);
        
    } finally {
        camera.close();
    }
}

/**
 * Demo 3: Combined Motion and Environmental Monitoring
 */
async function environmentalMonitor() {
    console.log('🌡️  === Environmental Monitoring Demo ===\n');
    
    const sensor = new PAA3905_MotionCapture(SPI_DEVICE);
    
    try {
        if (!(await sensor.begin())) {
            throw new Error('Sensor initialization failed');
        }
        
        console.log('🔍 Monitoring environmental conditions for 10 seconds...\n');
        console.log('Time\tLight Mode\tShutter\t\tSurface Q\tMotion Activity');
        console.log('----\t----------\t-------\t\t---------\t---------------');
        
        const startTime = Date.now();
        let samples = 0;
        let motionEvents = 0;
        let lightModeDistribution = { bright: 0, low: 0, superlow: 0 };
        
        while (Date.now() - startTime < 10000) {
            await sensor.readBurstMode();
            
            if (sensor.motionDataAvailable()) {
                const motion = sensor.getMotionData();
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                
                samples++;
                if (motion.deltaX !== 0 || motion.deltaY !== 0) {
                    motionEvents++;
                }
                
                lightModeDistribution[motion.lightMode]++;
                
                const motionIndicator = (Math.abs(motion.deltaX) + Math.abs(motion.deltaY)) > 5 ? '🔴' : '⚫';
                const shutterHex = '0x' + motion.shutter.toString(16).toUpperCase();
                
                console.log(`${elapsed}s\t${motion.lightMode.padEnd(10)}\t${shutterHex.padEnd(10)}\t${motion.surfaceQuality.toString().padEnd(9)}\t${motionIndicator}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100)); // 10 Hz
        }
        
        // Summary
        console.log('\n📈 Environmental Summary:');
        console.log(`Total samples: ${samples}`);
        console.log(`Motion activity: ${motionEvents}/${samples} (${Math.round(motionEvents/samples*100)}%)`);
        console.log(`Light conditions:`);
        console.log(`  Bright: ${lightModeDistribution.bright} samples`);
        console.log(`  Low: ${lightModeDistribution.low} samples`);
        console.log(`  Super-low: ${lightModeDistribution.superlow} samples`);
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        if (lightModeDistribution.superlow > samples * 0.5) {
            console.log('⚠️  Mostly super-low light conditions - consider adding illumination');
        } else if (lightModeDistribution.bright > samples * 0.7) {
            console.log('☀️  Good bright lighting conditions');
        }
        
        if (motionEvents < samples * 0.1) {
            console.log('🔇 Very stable environment - good for precision applications');
        } else if (motionEvents > samples * 0.5) {
            console.log('🌪️  High motion activity detected');
        }
        
    } finally {
        sensor.close();
    }
}

/**
 * Main demo runner
 */
async function runDemo() {
    console.log('🎯 PAA3905 Node.js Library Demo\n');
    console.log('This demo will test both motion detection and image capture\n');
    
    try {
        await motionDemo();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await imageDemo();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await environmentalMonitor();
        
        console.log('🎉 All demos completed successfully!');
        console.log('\nNext steps:');
        console.log('- Run individual tests: npm test, npm run test:frame');
        console.log('- Check the README.md for detailed API documentation');
        console.log('- Explore the test/ directory for more examples');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Check SPI device path (try /dev/spidev0.1 or /dev/spidev1.0)');
        console.log('2. Verify sensor wiring and power connections');
        console.log('3. Run with sudo to test permissions');
        console.log('4. Check if SPI is enabled in system configuration');
        process.exit(1);
    }
}

// Command line options
const args = process.argv.slice(2);

if (args.includes('--motion')) {
    motionDemo().catch(console.error);
} else if (args.includes('--image')) {
    imageDemo().catch(console.error);
} else if (args.includes('--monitor')) {
    environmentalMonitor().catch(console.error);
} else {
    runDemo().catch(console.error);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Demo interrupted by user');
    process.exit(0);
});