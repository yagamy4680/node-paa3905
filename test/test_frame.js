/**
 * PAA3905 Frame Capture Test
 * Tests raw image capture functionality (35x35 pixels)
 */

import { 
    PAA3905_FrameCapture, 
    Orientation 
} from '../src/index.js';
import { writeFileSync } from 'fs';

// Configuration
const SPI_DEVICE = '/dev/spidev1.1';  // Adjust for your system
const NUM_FRAMES = 5;
const SAVE_FRAMES = true;

async function testFrameCapture() {
    console.log('=== PAA3905 Frame Capture Test ===\n');
    
    let sensor = null;
    
    try {
        // Create frame capture instance
        console.log('Creating PAA3905 Frame Capture instance...');
        sensor = new PAA3905_FrameCapture(
            SPI_DEVICE,
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
        console.log(`🖼️  Frame size: ${PAA3905_FrameCapture.FRAME_WIDTH}x${PAA3905_FrameCapture.FRAME_HEIGHT} pixels`);
        console.log(`📊 Capturing ${NUM_FRAMES} frames...\n`);
        
        const frameStats = [];
        
        for (let frameNum = 1; frameNum <= NUM_FRAMES; frameNum++) {
            console.log(`📷 Capturing frame ${frameNum}/${NUM_FRAMES}...`);
            
            const startTime = Date.now();
            const frameResult = await sensor.captureFrameWithStats();
            const captureTime = Date.now() - startTime;
            
            const { frameData, statistics } = frameResult;
            frameStats.push({ ...statistics, captureTime });
            
            console.log(`   ⏱️  Capture time: ${captureTime}ms`);
            console.log(`   📊 Stats: Min=${statistics.min}, Max=${statistics.max}, Avg=${statistics.average}, Sum=${statistics.sum}`);
            
            // Display frame as ASCII art (scaled down for console)
            console.log('   🖼️  Frame preview (ASCII):');
            const ascii = PAA3905_FrameCapture.frameToASCII(frameData);
            const previewLines = ascii.split('\n').slice(0, 10); // Show first 10 lines
            previewLines.forEach(line => console.log('   ' + line.substring(0, 35))); // Show first 35 chars
            if (ascii.split('\n').length > 10) {
                console.log('   ... (truncated for display)');
            }
            
            // Save frame data if enabled
            if (SAVE_FRAMES) {
                const filename = `frame_${frameNum}_${Date.now()}.txt`;
                const frameText = createFrameReport(frameData, statistics, frameNum);
                writeFileSync(filename, frameText);
                console.log(`   💾 Saved detailed frame data to ${filename}`);
            }
            
            console.log('');
        }
        
        // Calculate overall statistics
        console.log('=== Overall Frame Statistics ===');
        const avgCaptureTime = frameStats.reduce((sum, stat) => sum + stat.captureTime, 0) / frameStats.length;
        const avgMin = frameStats.reduce((sum, stat) => sum + stat.min, 0) / frameStats.length;
        const avgMax = frameStats.reduce((sum, stat) => sum + stat.max, 0) / frameStats.length;
        const avgAverage = frameStats.reduce((sum, stat) => sum + stat.average, 0) / frameStats.length;
        
        console.log(`⏱️  Average capture time: ${avgCaptureTime.toFixed(1)}ms`);
        console.log(`📊 Average pixel min: ${avgMin.toFixed(1)}`);
        console.log(`📊 Average pixel max: ${avgMax.toFixed(1)}`);
        console.log(`📊 Average pixel average: ${avgAverage.toFixed(1)}`);
        console.log(`🎯 Estimated frame rate: ${(1000/avgCaptureTime).toFixed(1)} Hz`);
        
        // Performance assessment
        console.log('\n=== Performance Assessment ===');
        if (avgCaptureTime < 100) {
            console.log('✅ Excellent frame capture performance (<100ms per frame)');
        } else if (avgCaptureTime < 200) {
            console.log('✅ Good frame capture performance (100-200ms per frame)');
        } else {
            console.log('⚠️  Slow frame capture performance (>200ms per frame)');
        }
        
        if (avgMax - avgMin > 50) {
            console.log('✅ Good image contrast (dynamic range > 50)');
        } else {
            console.log('⚠️  Low image contrast - check lighting and objects in view');
        }
        
        console.log('\n🎉 Frame capture test completed!');
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
        process.exit(1);
        
    } finally {
        if (sensor) {
            console.log('\nCleaning up...');
            sensor.close();
        }
    }
}

/**
 * Create a detailed frame report
 */
function createFrameReport(frameData, statistics, frameNum) {
    let report = `PAA3905 Frame Capture Report - Frame ${frameNum}\n`;
    report += `Timestamp: ${new Date().toISOString()}\n`;
    report += `Frame Size: ${PAA3905_FrameCapture.FRAME_WIDTH}x${PAA3905_FrameCapture.FRAME_HEIGHT} pixels\n\n`;
    
    report += `Statistics:\n`;
    report += `- Minimum pixel value: ${statistics.min}\n`;
    report += `- Maximum pixel value: ${statistics.max}\n`;
    report += `- Average pixel value: ${statistics.average}\n`;
    report += `- Sum of all pixels: ${statistics.sum}\n`;
    report += `- Dynamic range: ${statistics.max - statistics.min}\n\n`;
    
    // ASCII representation
    report += `ASCII Representation:\n`;
    report += PAA3905_FrameCapture.frameToASCII(frameData);
    report += `\n`;
    
    // Binary representation
    report += `Binary Representation (threshold = 128):\n`;
    report += PAA3905_FrameCapture.frameToBitmap(frameData, 128);
    report += `\n`;
    
    // Raw data (hexadecimal)
    report += `Raw Pixel Data (hexadecimal):\n`;
    for (let row = 0; row < PAA3905_FrameCapture.FRAME_HEIGHT; row++) {
        let line = '';
        for (let col = 0; col < PAA3905_FrameCapture.FRAME_WIDTH; col++) {
            const pixel = frameData[row * PAA3905_FrameCapture.FRAME_WIDTH + col];
            line += pixel.toString(16).padStart(2, '0') + ' ';
        }
        report += line + '\n';
    }
    
    return report;
}

/**
 * Continuous frame capture mode
 */
async function continuousCapture() {
    console.log('=== Continuous Frame Capture ===\n');
    console.log('Press Ctrl+C to stop\n');
    
    const sensor = new PAA3905_FrameCapture(SPI_DEVICE);
    
    if (!(await sensor.begin())) {
        throw new Error('Failed to initialize sensor');
    }
    
    let frameCount = 0;
    const startTime = Date.now();
    
    console.log('📷 Starting continuous capture...\n');
    
    const captureInterval = setInterval(async () => {
        try {
            frameCount++;
            const frameResult = await sensor.captureFrameWithStats();
            const elapsed = (Date.now() - startTime) / 1000;
            const fps = frameCount / elapsed;
            
            console.clear();
            console.log(`Frame: ${frameCount} | Time: ${elapsed.toFixed(1)}s | FPS: ${fps.toFixed(1)}`);
            console.log(`Stats: Min=${frameResult.statistics.min} Max=${frameResult.statistics.max} Avg=${frameResult.statistics.average.toFixed(1)}\n`);
            
            // Display frame
            const bitmap = PAA3905_FrameCapture.frameToBitmap(frameResult.frameData);
            console.log(bitmap);
            
        } catch (error) {
            console.error('❌ Capture error:', error.message);
            clearInterval(captureInterval);
        }
    }, 100); // Attempt 10 FPS
    
    // Handle cleanup
    process.on('SIGINT', () => {
        clearInterval(captureInterval);
        sensor.close();
        console.log('\n👋 Continuous capture stopped');
        process.exit(0);
    });
}

/**
 * Interactive pixel inspector
 */
async function pixelInspector() {
    console.log('=== Pixel Inspector ===\n');
    
    const sensor = new PAA3905_FrameCapture(SPI_DEVICE);
    
    if (!(await sensor.begin())) {
        throw new Error('Failed to initialize sensor');
    }
    
    console.log('📷 Capturing frame for inspection...');
    const frameResult = await sensor.captureFrameWithStats();
    const { frameData, statistics } = frameResult;
    
    console.log('\n🔍 Frame captured! Use coordinates to inspect pixels:');
    console.log('Example: Enter "17,17" to inspect center pixel\n');
    
    // Display frame with coordinate grid
    console.log('   ' + Array.from({length: 35}, (_, i) => (i % 5 === 0) ? i.toString().padStart(2)[0] : ' ').join(''));
    console.log('   ' + Array.from({length: 35}, (_, i) => (i % 5 === 0) ? i.toString().padStart(2)[1] || '0' : ' ').join(''));
    
    for (let row = 0; row < 35; row++) {
        let line = row.toString().padStart(2) + ' ';
        for (let col = 0; col < 35; col++) {
            const pixel = frameData[row * 35 + col];
            line += pixel > 128 ? '█' : '·';
        }
        console.log(line);
    }
    
    console.log(`\nFrame statistics: Min=${statistics.min}, Max=${statistics.max}, Avg=${statistics.average}`);
    console.log('\nEnter coordinates as "x,y" or "quit" to exit:');
    
    sensor.close();
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--continuous')) {
        await continuousCapture();
    } else if (args.includes('--inspect')) {
        await pixelInspector();
    } else {
        await testFrameCapture();
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test interrupted by user');
    process.exit(1);
});

main().catch(console.error);