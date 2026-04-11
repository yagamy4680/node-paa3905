
Write a nodejs natvie addon module, which calculate the optical flow between frames (35x35) captured from PAA3905 sensor. The module should be able to process the frames in real-time and provide the optical flow data as output. To create a Node.js native addon module for calculating optical flow between frames captured from the PAA3905 sensor, you can use the `node-addon-api` which provides a C++ API for building native addons.

To calculate optical flow, please integrate `externals/PX4-OpticalFlow/src/px4flow.cpp` into the addon. Below is an example of how you can create a Node.js native addon module for this purpose.

The calculated optical flow data will be returned as a JavaScript object containing the flow vectors. These vectors are shown on the console for demonstration purposes. These vectors are also forwarded to web frontend via WebSocket for real-time visualization.

---

## Implementation Summary

### Architecture

```
  PAA3905 sensor (SPI)
        │
  PAA3905_FrameCapture.js   ← captures 35×35 raw frames
        │
  OpticalFlowNative.js      ← JS wrapper (ESM)
        │
  optical_flow.node          ← native addon (.node binary)
        │
  PX4Flow (px4flow.cpp)      ← block-matching SAD algorithm
        │
  { flowX, flowY, quality }  → console + WebSocket → browser
```

### Files Created / Modified

| File | Description |
|------|-------------|
| `src/addon/optical_flow_addon.cc` | N-API native addon wrapping PX4Flow |
| `src/OpticalFlowNative.js` | ESM JavaScript wrapper class |
| `binding.gyp` | node-gyp build configuration |
| `package.json` | Added `node-addon-api` dep and build scripts |
| `src/index.js` | Added `OpticalFlowNative` export |
| `demo-frame-web.js` | Integrated optical flow into frame streaming |
| `assets/demo-frame-web/index.html` | Added flow vector overlay and stats |

### API

```javascript
import { OpticalFlowNative } from './src/OpticalFlowNative.js';

const flow = new OpticalFlowNative({
    imageWidth: 35,        // default
    imageHeight: 35,       // default
    searchSize: 4,         // max pixel displacement to search
    featureThreshold: 30,  // min gradient for block matching
    valueThreshold: 5000   // max SAD distance to accept
});

// Feed consecutive frames
const result = flow.computeFlow(frameUint8Array);
// => { flowX: -0.5, flowY: 1.25, quality: 153 }

flow.reset(); // clear state for new sequence
```

---

## How to Build the Native Addon (Step-by-Step)

### Prerequisites

1. **Node.js ≥ 20.x** — required by the project

2. **C++ compiler toolchain** — needed by node-gyp to compile the addon:

   **macOS:**
   ```bash
   xcode-select --install
   ```

   **Debian / Ubuntu / Raspberry Pi OS:**
   ```bash
   sudo apt-get update
   sudo apt-get install -y build-essential python3
   ```

   **Fedora / RHEL:**
   ```bash
   sudo dnf groupinstall "Development Tools"
   sudo dnf install python3
   ```

3. **node-gyp** (installed automatically as an npm dependency, or install globally):
   ```bash
   npm install -g node-gyp
   ```

### Step 1: Install npm dependencies

```bash
cd node-paa3905
npm install
```

This installs:
- `node-addon-api` — C++ N-API header-only library
- `@eeemarv/io-spi` — SPI device access
- `express` / `socket.io` — web demo (devDependencies)

It also **automatically triggers `node-gyp rebuild`** via the `install` script, compiling the native addon.

### Step 2: Build the native addon (if needed)

If you need to rebuild manually (e.g., after modifying C++ code):

```bash
npm run build
```

Or equivalently:

```bash
node-gyp rebuild
```

For a debug build with symbols:

```bash
npm run build:debug
```

### Step 3: Verify the build

After a successful build, the compiled addon will be at:

```
build/Release/optical_flow.node
```

You can verify it loads correctly:

```bash
node -e "import { OpticalFlowNative } from './src/OpticalFlowNative.js'; \
  const f = new OpticalFlowNative(); \
  console.log(f.computeFlow(new Uint8Array(1225)));" \
  --input-type=module
```

Expected output:

```
{ flowX: 0, flowY: 0, quality: 0 }
```

(First frame always returns zero flow since there is no previous frame to compare.)

### Step 4: Run the web demo

```bash
npm run demo:web
```

Open `http://localhost:3000` in a browser to see:
- Live 35×35 infrared frames from the PAA3905 sensor
- **Green arrow overlay** showing the optical flow direction and magnitude
- Optical flow statistics panel: flowX, flowY, quality, direction, magnitude

### Clean build artifacts

```bash
npm run clean
```

---

## Build Troubleshooting

| Problem | Solution |
|---------|----------|
| `gyp ERR! find Python` | Install Python 3: `sudo apt install python3` or `brew install python3` |
| `gyp ERR! stack Error: Could not find...C/C++ compiler` | Install build tools (see Prerequisites) |
| `Error: Cannot find module '../build/Release/optical_flow.node'` | Run `npm run build` first |
| `node-gyp rebuild` fails on ARM (Raspberry Pi) | Ensure `build-essential` is installed; add swap if <1GB RAM |
| Header not found: `napi.h` | Run `npm install` to ensure `node-addon-api` is present |

---

## Algorithm Details

The PX4Flow block-matching algorithm (`px4flow.cpp`) works as follows:

1. Divides each 35×35 frame into a 5×5 grid of 8×8 pixel tiles
2. For each tile with sufficient gradient (above `featureThreshold`):
   - Searches `±searchSize` offsets using Sum of Absolute Differences (SAD)
   - Finds the best matching position in the new frame
   - Applies sub-pixel refinement (8-direction half-pixel accuracy)
3. Aggregates all tile displacements into a mean flow vector
4. Returns `quality` (0–255) proportional to how many tiles matched successfully

For 35×35 images with `searchSize=4`:
- Tile grid spans pixels [5..28] in each dimension
- Each tile can detect motion of ±4 pixels between frames
- Sub-pixel refinement adds ±0.5px accuracy → effective resolution ≈ 0.5px