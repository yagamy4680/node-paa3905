/**
 * PAA3905 Motion Capture Test
 * Tests optical flow motion detection functionality
 */

import { 
    PAA3905_MotionCapture, 
    DetectionMode, 
    AutoMode, 
    Orientation,
    LightMode 
} from '../src/index.js';

// Configuration
const SPI_DEVICE = '/dev/spidev0.0';  // Adjust for your system
const TEST_DURATION = 10000; // 10 seconds
const SAMPLE_RATE = 50; // Hz

async function testMotionCapture() {
    console.log('=== PAA3905 Motion Capture Test ===\n');
    
    let sensor = null;
    let interval = null;
    
    try {
        // Create motion capture instance
        console.log('Creating PAA3905 Motion Capture instance...');
        sensor = new PAA3905_MotionCapture(
            SPI_DEVICE,
            DetectionMode.STANDARD,
            AutoMode.AUTO_01,
            Orientation.NORMAL,
            0x2A
        );
        
        console.log('Initializing sensor...');
        const success = await sensor.begin();
        
        if (!success) {
            throw new Error('Sensor initialization failed');
        }
        
        console.log('✅ Sensor initialized successfully!');
        console.log(`📏 Resolution: ${sensor.getResolution()} CPM`);
        console.log(`⏱️  Test duration: ${TEST_DURATION/1000} seconds`);
        console.log(`📊 Sample rate: ${SAMPLE_RATE} Hz\n`);
        
        // Motion tracking variables
        let sampleCount = 0;
        let totalDeltaX = 0;
        let totalDeltaY = 0;
        let validSamples = 0;
        let maxDeltaX = 0;
        let maxDeltaY = 0;
        let motionEvents = 0;
        
        console.log('🚀 Starting motion capture...');
        console.log('Move the sensor or object under the sensor to see motion detection\n');
        console.log('Time\t\tDX\tDY\tQuality\tShutter\t\tLight\tValid\tSurface');
        console.log('----\t\t--\t--\t-------\t-------\t\t-----\t-----\t-------');
        
        const startTime = Date.now();
        
        // Main sampling loop
        interval = setInterval(async () => {
            try {
                // Read burst motion data
                await sensor.readBurstMode();
                
                if (sensor.motionDataAvailable()) {
                    const motionData = sensor.getMotionData();
                    sampleCount++;
                    
                    // Accumulate statistics
                    totalDeltaX += Math.abs(motionData.deltaX);
                    totalDeltaY += Math.abs(motionData.deltaY);
                    
                    if (Math.abs(motionData.deltaX) > Math.abs(maxDeltaX)) {
                        maxDeltaX = motionData.deltaX;
                    }
                    if (Math.abs(motionData.deltaY) > Math.abs(maxDeltaY)) {
                        maxDeltaY = motionData.deltaY;
                    }
                    
                    // Check if data is valid
                    const isValid = sensor.dataAboveThresholds(
                        motionData.lightMode,
                        motionData.surfaceQuality,
                        motionData.shutter
                    );
                    
                    if (isValid) {
                        validSamples++;
                    }
                    
                    // Count motion events (non-zero deltas)
                    if (motionData.deltaX !== 0 || motionData.deltaY !== 0) {
                        motionEvents++;
                    }
                    
                    // Display current reading
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    const surfaceStatus = motionData.challengingSurface ? 'Challenging' : 'Good';
                    const validStatus = isValid ? 'Yes' : 'No';
                    
                    console.log(
                        `${elapsed}s\t\t${motionData.deltaX}\t${motionData.deltaY}\t` +
                        `${motionData.surfaceQuality}\t0x${motionData.shutter.toString(16).toUpperCase()}\t\t` +
                        `${motionData.lightMode}\t${validStatus}\t${surfaceStatus}`
                    );
                }
                
                // Check if test duration is complete
                if (Date.now() - startTime >= TEST_DURATION) {
                    clearInterval(interval);
                    interval = null;
                    
                    // Display final statistics
                    console.log('\n=== Test Results ===');
                    console.log(`📊 Total samples: ${sampleCount}`);
                    console.log(`✅ Valid samples: ${validSamples} (${((validSamples/sampleCount)*100).toFixed(1)}%)`);
                    console.log(`🎯 Motion events: ${motionEvents} (${((motionEvents/sampleCount)*100).toFixed(1)}%)`);
                    console.log(`📈 Average |ΔX|: ${(totalDeltaX/sampleCount).toFixed(2)}`);
                    console.log(`📈 Average |ΔY|: ${(totalDeltaY/sampleCount).toFixed(2)}`);
                    console.log(`🔝 Max ΔX: ${maxDeltaX}`);
                    console.log(`🔝 Max ΔY: ${maxDeltaY}`);
                    
                    // Performance assessment
                    console.log('\n=== Performance Assessment ===');
                    if (validSamples > sampleCount * 0.8) {
                        console.log('✅ Excellent data quality (>80% valid samples)');
                    } else if (validSamples > sampleCount * 0.5) {
                        console.log('⚠️  Moderate data quality (50-80% valid samples)');
                        console.log('   Consider improving lighting or surface conditions');
                    } else {
                        console.log('❌ Poor data quality (<50% valid samples)');
                        console.log('   Check lighting, surface, and sensor positioning');
                    }
                    
                    if (motionEvents > 0) {
                        console.log('✅ Motion detection working correctly');
                    } else {
                        console.log('⚠️  No motion detected - try moving the sensor or target');
                    }
                    
                    console.log('\n🎉 Motion capture test completed!');
                }
                
            } catch (error) {
                console.error('❌ Error during motion capture:', error.message);
                if (interval) {
                    clearInterval(interval);
                }
            }
        }, 1000 / SAMPLE_RATE);
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
        process.exit(1);
        
    } finally {
        if (interval) {
            clearInterval(interval);
        }
        if (sensor) {
            console.log('\nCleaning up...');
            sensor.close();
        }
    }
}

// Utility function to create a simple real-time motion monitor
async function realTimeMonitor() {
    console.log('=== Real-time Motion Monitor ===\n');
    console.log('Press Ctrl+C to stop\n');
    
    const sensor = new PAA3905_MotionCapture(SPI_DEVICE);
    
    if (!(await sensor.begin())) {
        throw new Error('Failed to initialize sensor');
    }
    
    console.log('📊 Real-time motion data (DX, DY, Quality):');
    
    const monitorInterval = setInterval(async () => {
        try {
            await sensor.readBurstMode();
            
            if (sensor.motionDataAvailable()) {
                const data = sensor.getMotionData();
                const bar = '█'.repeat(Math.min(Math.abs(data.deltaX) + Math.abs(data.deltaY), 50));
                console.log(`DX:${data.deltaX.toString().padStart(6)} DY:${data.deltaY.toString().padStart(6)} Q:${data.surfaceQuality.toString().padStart(3)} ${bar}`);
            }
        } catch (error) {
            console.error('Monitor error:', error.message);
            clearInterval(monitorInterval);
        }
    }, 20); // 50 Hz
    
    // Handle cleanup
    process.on('SIGINT', () => {
        clearInterval(monitorInterval);
        sensor.close();
        console.log('\n👋 Monitor stopped');
        process.exit(0);
    });
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--monitor')) {
        await realTimeMonitor();
    } else {
        await testMotionCapture();
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test interrupted by user');
    process.exit(1);
});

main().catch(console.error);