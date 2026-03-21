/**
 * Basic PAA3905 Connection Test
 * Tests initialization and product ID verification
 */

import { 
    PAA3905_MotionCapture, 
    DetectionMode, 
    AutoMode, 
    Orientation 
} from '../src/index.js';

// Configuration
const SPI_DEVICE = '/dev/spidev1.1';  // Adjust for your system

/**
 * Check SPI system prerequisites
 */
async function checkSpiSetup() {
    console.log('🔧 Checking SPI setup...');
    
    try {
        // Check if SPI devices exist
        const { execSync } = await import('child_process');
        const result = execSync('ls -la /dev/spidev* 2>/dev/null || echo "No SPI devices found"').toString();
        console.log('📋 Available SPI devices:');
        console.log(result);
        
        // Check if running as root or in spi group
        const groups = execSync('groups').toString();
        const isRoot = process.getuid && process.getuid() === 0;
        const inSpiGroup = groups.includes('spi');
        
        if (isRoot) {
            console.log('⚠️  Running as root (sudo)');
        } else if (inSpiGroup) {
            console.log('✅ User is in spi group');
        } else {
            console.log('⚠️  User not in spi group - may need sudo or udev configuration');
        }
        
    } catch (error) {
        console.log('⚠️  Could not check SPI setup:', error.message);
    }
    console.log('');
}

async function testBasicConnection() {
    console.log('=== PAA3905 Basic Connection Test ===\n');
    
    await checkSpiSetup();
    
    let sensor = null;
    
    try {
        // Create motion capture instance
        console.log('Creating PAA3905 Motion Capture instance...');
        sensor = new PAA3905_MotionCapture(
            SPI_DEVICE,
            DetectionMode.STANDARD,
            AutoMode.AUTO_01,
            Orientation.NORMAL,
            0x2A  // Standard resolution
        );
        
        console.log('Initializing sensor...');
        const success = await sensor.begin();
        
        if (success) {
            console.log('✅ Sensor initialization successful!');
            
            // Display SPI configuration that worked
            const spiConfig = sensor.getCurrentSpiConfig();
            if (spiConfig) {
                console.log(`⚙️  SPI Config: Mode ${spiConfig.mode}, Speed ${spiConfig.max_speed_hz/1000}kHz`);
            }
            console.log(`📏 Resolution: ${sensor.getResolution()} CPM`);
            
            // Test basic register reads
            console.log('\nTesting register reads...');
            const productId = await sensor.readByte(0x00); // Product ID
            const inverseId = await sensor.readByte(0x5F); // Inverse Product ID
            
            console.log(`🔍 Product ID: 0x${productId.toString(16).toUpperCase()} (expected: 0xA2)`);
            console.log(`🔍 Inverse ID: 0x${inverseId.toString(16).toUpperCase()} (expected: 0x5D)`);
            
            if (productId === 0xA2 && inverseId === 0x5D) {
                console.log('✅ Product ID verification passed!');
            } else {
                console.log('❌ Product ID verification failed!');
            }
            
            // Test configuration
            console.log('\nTesting configuration...');
            await sensor.setResolution(0x50);
            console.log(`📏 New resolution: ${sensor.getResolution()} CPM`);
            
            console.log('\n🎉 Basic connection test completed successfully!');
            return true;
            
        } else {
            console.log('❌ Sensor initialization failed!');
            console.log('Possible causes:');
            console.log('- SPI device not available or wrong path');
            console.log('- Permission denied (run with sudo or configure udev rules)');
            console.log('- Sensor not connected or not powered');
            console.log('- Wrong SPI wiring');
            return false;
        }
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
        console.log('\nTroubleshooting tips:');
        console.log('1. Check SPI device path (ls -l /dev/spi*)');
        console.log('2. Verify permissions (user in spi group)');
        console.log('3. Ensure SPI is enabled in system configuration');
        
        if (error.message.includes('SPI_IOC_WR_MODE') || error.message.includes('Invalid argument')) {
            console.log('4. SPI Mode issue detected:');
            console.log('   - Your system may not support SPI Mode 3');
            console.log('   - Some Raspberry Pi configurations only support Mode 0');
            console.log('   - The library will try multiple fallback modes automatically');
        }
        
        console.log('5. Check hardware connections:');
        console.log('   - MOSI, MISO, SCLK connected correctly');
        console.log('   - CS pin connected and properly controlled');
        console.log('   - Power (3.3V) and ground connected');
        console.log('6. Try running with sudo for permission test');
        console.log('7. Check if SPI device exists: ls -la /dev/spidev*');
        return false;
        
    } finally {
        if (sensor) {
            console.log('\nCleaning up...');
            sensor.close();
        }
    }
}

// Main execution
async function main() {
    const success = await testBasicConnection();
    process.exit(success ? 0 : 1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test interrupted by user');
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

main().catch(console.error);