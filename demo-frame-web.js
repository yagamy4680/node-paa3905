/**
 * PAA3905 Frame Capture Web Demo
 * Real-time infrared image streaming using Socket.IO and Express
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { PAA3905_FrameCapture, Orientation } from './src/index.js';
import { OpticalFlowNative } from './src/OpticalFlowNative.js';

// Configuration
const PORT = 3000;
const SPI_DEVICE = '/dev/spidev1.1';  // Adjust for your system
const FRAME_RATE = 10; // Target FPS for streaming
const CAPTURE_TIMEOUT = 5000; // 5 second timeout between captures

// ES module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new SocketIOServer(server);

// Global variables
let frameCapture = null;
let opticalFlow = null;
let isCapturing = false;
let connectedClients = 0;
let frameStats = {
    totalFrames: 0,
    droppedFrames: 0,
    startTime: Date.now(),
    lastCaptureTime: 0,
    avgCaptureTime: 0
};

// Recording state
let isRecording = false;
let recordingTimeout = null;
let recordingStats = {
    frameCount: 0,
    recordingId: 0,
    startTime: 0,
    directory: '/tmp',
    csvFilePath: ''
};

/**
 * Initialize PAA3905 sensor
 */
async function initializeSensor() {
    console.log('🔧 Initializing PAA3905 frame capture sensor...');
    
    try {
        frameCapture = new PAA3905_FrameCapture(
            SPI_DEVICE,
            Orientation.NORMAL,
            0x2A
        );
        
        const success = await frameCapture.begin();
        if (!success) {
            throw new Error('Sensor initialization failed');
        }
        
        console.log('✅ PAA3905 sensor initialized successfully');
        console.log(`📏 Resolution: ${frameCapture.getResolution()} CPM`);

        // Initialize optical flow calculator
        opticalFlow = new OpticalFlowNative();
        console.log('✅ Optical flow calculator initialized (PX4 block-matching, 35x35)');

        return true;
        
    } catch (error) {
        console.error('❌ Failed to initialize sensor:', error.message);
        return false;
    }
}

/**
 * Capture and broadcast frame data
 */
async function captureAndBroadcast() {
    if (!frameCapture || connectedClients === 0) {
        return;
    }
    
    try {
        const captureStartTime = Date.now();
        
        // Capture frame with statistics
        const result = await frameCapture.captureFrameWithStats();
        
        const captureEndTime = Date.now();
        const captureTime = captureEndTime - captureStartTime;
        
        // Update frame statistics
        frameStats.totalFrames++;
        frameStats.lastCaptureTime = captureTime;
        frameStats.avgCaptureTime = frameStats.avgCaptureTime === 0 
            ? captureTime 
            : (frameStats.avgCaptureTime * 0.9 + captureTime * 0.1);
        
        // Create broadcast payload
        const frameData = {
            timestamp: captureEndTime,
            width: result.width,
            height: result.height,
            pixels: Array.from(result.frameData), // Convert Uint8Array to regular array for JSON
            statistics: result.statistics,
            captureTime: captureTime,
            frameNumber: frameStats.totalFrames
        };

        // Compute optical flow between consecutive frames
        if (opticalFlow) {
            const flow = opticalFlow.computeFlow(result.frameData);
            frameData.opticalFlow = {
                flowX: flow.flowX,
                flowY: flow.flowY,
                quality: flow.quality
            };
            
            // Save to files if recording
            if (isRecording) {
                try {
                    // Save frame as raw file
                    const frameFilePath = saveFrameToFile(
                        result.frameData, 
                        recordingStats.directory, 
                        captureEndTime
                    );
                    
                    // Append optical flow data to CSV
                    recordingStats.frameCount++;
                    appendToCsv(
                        recordingStats.csvFilePath,
                        recordingStats.frameCount,
                        captureEndTime,
                        flow.flowX,
                        flow.flowY,
                        flow.quality
                    );
                    
                    // Log every 10 frames during recording
                    if (recordingStats.frameCount % 10 === 0) {
                        console.log(`📹 Recorded frame ${recordingStats.frameCount}: ${frameFilePath}`);
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to save recording data:', error.message);
                }
            }
        }
        
        // Broadcast to all connected clients
        io.emit('frame-data', frameData);
        
        // Log periodic statistics
        if (frameStats.totalFrames % 50 === 0) {
            const uptime = (Date.now() - frameStats.startTime) / 1000;
            const fps = frameStats.totalFrames / uptime;
            const flowInfo = frameData.opticalFlow
                ? ` | flow=(${frameData.opticalFlow.flowX.toFixed(2)}, ${frameData.opticalFlow.flowY.toFixed(2)}) q=${frameData.opticalFlow.quality}`
                : '';
            console.log(`📊 Frame ${frameStats.totalFrames}: ${captureTime}ms capture, ${fps.toFixed(1)} fps avg${flowInfo}`);
        }
        
    } catch (error) {
        frameStats.droppedFrames++;
        console.error('❌ Frame capture failed:', error.message);
    }
}

/**
 * Start continuous frame capture loop
 */
async function startCapture() {
    if (isCapturing) return;
    
    isCapturing = true;
    console.log(`🎬 Starting frame capture at ${FRAME_RATE} FPS`);
    
    const frameInterval = 1000 / FRAME_RATE;
    
    while (isCapturing && connectedClients > 0) {
        const loopStart = Date.now();
        
        await captureAndBroadcast();
        
        // Calculate sleep time to maintain frame rate
        const processingTime = Date.now() - loopStart;
        const sleepTime = Math.max(0, frameInterval - processingTime);
        
        if (sleepTime > 0) {
            await new Promise(resolve => setTimeout(resolve, sleepTime));
        } else if (processingTime > frameInterval * 2) {
            // Log if we're significantly behind
            console.log(`⚠️  Slow capture: ${processingTime}ms (target: ${frameInterval}ms)`);
        }
    }
    
    console.log('⏸️  Frame capture stopped');
    isCapturing = false;
}

/**
 * Stop frame capture
 */
function stopCapture() {
    isCapturing = false;
}

/**
 * Save frame data as raw file
 */
function saveFrameToFile(frameData, directory, timestamp) {
    try {
        // Ensure directory exists
        if (!existsSync(directory)) {
            mkdirSync(directory, { recursive: true });
        }
        
        const filename = `paa3905-${timestamp}.raw`;
        const filepath = join(directory, filename);
        
        // Write raw frame data (35x35 pixels)
        writeFileSync(filepath, frameData);
        
        return filepath;
    } catch (error) {
        console.error('❌ Failed to save frame:', error.message);
        throw error;
    }
}

/**
 * Initialize or append to CSV file
 */
function initializeCsvFile(directory) {
    try {
        // Ensure directory exists
        if (!existsSync(directory)) {
            mkdirSync(directory, { recursive: true });
        }
        
        const csvPath = join(directory, 'paa3905-optical-flow.csv');
        
        // Write header if file doesn't exist
        if (!existsSync(csvPath)) {
            const header = 'id,timestamp,flow-x,flow-y,quality\n';
            writeFileSync(csvPath, header);
        }
        
        return csvPath;
    } catch (error) {
        console.error('❌ Failed to initialize CSV file:', error.message);
        throw error;
    }
}

/**
 * Append optical flow data to CSV
 */
function appendToCsv(csvPath, id, timestamp, flowX, flowY, quality) {
    try {
        const paddedId = id.toString().padStart(5, '0');
        const formattedFlowX = flowX.toFixed(4);
        const formattedFlowY = flowY.toFixed(4);
        const row = `${paddedId},${timestamp},${formattedFlowX},${formattedFlowY},${quality}\n`;
        
        appendFileSync(csvPath, row);
    } catch (error) {
        console.error('❌ Failed to append to CSV:', error.message);
        throw error;
    }
}

/**
 * Start recording frames and optical flow data
 */
async function startRecording(directory = '/tmp', timeoutSeconds = 10) {
    if (isRecording) {
        throw new Error('Recording already in progress');
    }
    
    if (!frameCapture || !opticalFlow) {
        throw new Error('Sensor not initialized');
    }
    
    console.log(`📹 Starting recording to directory: ${directory}`);
    
    // Initialize recording state
    isRecording = true;
    recordingStats.frameCount = 0;
    recordingStats.recordingId++;
    recordingStats.startTime = Date.now();
    recordingStats.directory = directory;
    
    // Initialize CSV file
    recordingStats.csvFilePath = initializeCsvFile(directory);
    
    // Set timeout if specified
    if (timeoutSeconds > 0) {
        recordingTimeout = setTimeout(() => {
            console.log(`⏰ Recording timeout (${timeoutSeconds}s) reached, stopping...`);
            stopRecording();
        }, timeoutSeconds * 1000);
    }
    
    console.log(`✅ Recording started (timeout: ${timeoutSeconds > 0 ? timeoutSeconds + 's' : 'none'})`);
    
    return {
        message: 'Recording started',
        directory: directory,
        timeout: timeoutSeconds,
        recordingId: recordingStats.recordingId
    };
}

/**
 * Stop recording and flush data
 */
function stopRecording() {
    if (!isRecording) {
        return {
            message: 'No recording in progress',
            framesCaptured: 0
        };
    }
    
    isRecording = false;
    
    // Clear timeout
    if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
    }
    
    const duration = Date.now() - recordingStats.startTime;
    const frameCount = recordingStats.frameCount;
    
    console.log(`🛑 Recording stopped. Captured ${frameCount} frames in ${duration}ms`);
    
    return {
        message: 'Recording stopped',
        framesCaptured: frameCount,
        duration: duration,
        directory: recordingStats.directory,
        csvFile: recordingStats.csvFilePath
    };
}

// Serve static files and web interface
app.use(express.static('public'));
app.use(express.static('assets'));

// Main web interface route
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'assets', 'demo-frame-web', 'index.html'));
});

// REST API endpoints for recording
app.get('/api/v1/recording/start', async (req, res) => {
    try {
        const directory = req.query.dir || '/tmp';
        const timeoutParam = req.query.timeout || '10';
        const timeout = timeoutParam === '-1' ? -1 : parseInt(timeoutParam, 10);
        
        if (isNaN(timeout) && timeout !== -1) {
            return res.status(400).json({
                error: 'Invalid timeout parameter',
                message: 'Timeout must be a number or -1 for no timeout'
            });
        }
        
        const result = await startRecording(directory, timeout);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Start recording API error:', error.message);
        res.status(500).json({
            error: 'Failed to start recording',
            message: error.message
        });
    }
});

app.get('/api/v1/recording/stop', (req, res) => {
    try {
        const result = stopRecording();
        res.json(result);
        
    } catch (error) {
        console.error('❌ Stop recording API error:', error.message);
        res.status(500).json({
            error: 'Failed to stop recording',
            message: error.message
        });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    connectedClients++;
    console.log(`🔌 Client connected (${connectedClients} total clients)`);
    
    // Send current frame statistics
    socket.emit('stats-update', frameStats);
    
    // Start capture if this is the first client
    if (connectedClients === 1 && !isCapturing) {
        startCapture();
    }
    
    socket.on('disconnect', () => {
        connectedClients--;
        console.log(`📤 Client disconnected (${connectedClients} total clients)`);
        
        // Stop capture if no clients connected
        if (connectedClients === 0) {
            stopCapture();
        }
    });
    
    // Handle client-side errors
    socket.on('client-error', (error) => {
        console.log('Client error:', error);
    });
});

// Graceful shutdown handling
async function shutdown() {
    console.log('🛑 Shutting down server...');
    
    stopCapture();
    
    if (frameCapture) {
        frameCapture.close();
    }
    
    server.close(() => {
        console.log('👋 Server stopped');
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Global error handling
process.on('unhandledRejection', (error) => {
    console.error('🔥 Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('🔥 Uncaught Exception:', error);
    shutdown();
});

// Start server
async function startServer() {
    console.log('🚀 Starting PAA3905 Frame Capture Web Server...');
    console.log(`📱 SPI Device: ${SPI_DEVICE}`);
    console.log(`🎯 Target Frame Rate: ${FRAME_RATE} FPS\n`);
    
    // Initialize sensor
    const sensorReady = await initializeSensor();
    if (!sensorReady) {
        console.error('❌ Cannot start server without sensor');
        process.exit(1);
    }
    
    // Start HTTP server
    server.listen(PORT, () => {
        console.log(`🌐 Web server running on http://localhost:${PORT}`);
        console.log(`🔗 Socket.IO server ready for connections`);
        console.log('📋 Press Ctrl+C to stop\n');
        
        // Log system info
        console.log('📊 System Information:');
        console.log(`   Node.js: ${process.version}`);
        console.log(`   Platform: ${process.platform}`);
        console.log(`   Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`);
        console.log('');
        
        console.log('🎉 Ready for connections! Open your browser and navigate to:');
        console.log(`   👉 http://localhost:${PORT}`);
        console.log('');
    });
}

// Start the application
startServer().catch(console.error);