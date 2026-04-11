/**
 * Test for the optical flow native addon
 */

import { OpticalFlowNative } from '../src/OpticalFlowNative.js';

console.log('=== Optical Flow Native Addon Test ===\n');

const flow = new OpticalFlowNative();

// Test 1: First frame returns zero flow
const frame1 = new Uint8Array(1225);
const result1 = flow.computeFlow(frame1);
console.log('Test 1 - First frame (zero):', result1);
console.assert(result1.quality === 0, 'First frame should have quality=0');

// Test 2: Two identical frames should produce zero flow
const frame2 = new Uint8Array(1225);
for (let i = 0; i < 1225; i++) frame2[i] = Math.floor(Math.random() * 256);
flow.reset();
flow.computeFlow(frame2);
const result2 = flow.computeFlow(frame2);
console.log('Test 2 - Identical frames:', result2);
console.assert(result2.flowX === 0 && result2.flowY === 0, 'Identical frames should have zero flow');

// Test 3: Shifted frame should produce flow with textured pattern
const frame3 = new Uint8Array(1225);
const frame4 = new Uint8Array(1225);
// Create a pseudo-random textured pattern using a simple LCG
let seed = 42;
for (let i = 0; i < 1225; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    frame3[i] = (seed >> 16) & 0xFF;
}
// Shift frame3 by 2 pixels in X direction into frame4
for (let y = 0; y < 35; y++) {
    for (let x = 0; x < 33; x++) {
        frame4[y * 35 + x] = frame3[y * 35 + (x + 2)];
    }
    // Fill right edge with neighbor values
    frame4[y * 35 + 33] = frame4[y * 35 + 32];
    frame4[y * 35 + 34] = frame4[y * 35 + 32];
}
flow.reset();
flow.computeFlow(frame3);
const result3 = flow.computeFlow(frame4);
console.log('Test 3 - Shifted frames (x+2):', result3);
console.assert(result3.quality > 0, 'Shifted frames should have quality > 0');

// Test 4: Reset clears state
flow.reset();
const result4 = flow.computeFlow(frame3);
console.log('Test 4 - After reset:', result4);
console.assert(result4.quality === 0, 'After reset, first frame should have quality=0');

console.log('\n=== All tests passed! ===');
