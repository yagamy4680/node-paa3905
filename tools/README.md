# PAA3905 Tools

This directory contains utility scripts for working with PAA3905 sensor data.

## Raw to PNG Converter

The `raw_to_png.py` script converts raw binary frame files captured from the PAA3905 sensor into PNG images for visualization and analysis.

## PNG to Video Converter

The `png_to_video.py` script converts timestamped PNG files into MP4 videos with accurate frame timing based on the epoch timestamps embedded in filenames.

### Installation

Install the required Python dependencies. The recommended approach is using `uv` for fast package management:

```bash
# Create a virtual environment and install dependencies with uv (recommended)
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

Alternative installation methods:

```bash
# Using standard virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Or for user installations (if system allows):
```bash
pip install --user Pillow numpy opencv-python
```

### Usage

#### Raw to PNG Conversion

Convert all .raw files in a directory:

```bash
python3 raw_to_png.py <directory> [--width WIDTH] [--height HEIGHT]
```

#### PNG to Video Conversion

Convert timestamped PNG files to MP4 video:

```bash
python3 png_to_video.py <directory> [--output VIDEO.mp4] [--fps FPS] [--scale SCALE]
```

### Examples

#### Raw to PNG Examples

Convert PAA3905 frames (35x35 pixels) from /tmp directory:
```bash
python3 raw_to_png.py /tmp
```

Convert with custom dimensions:
```bash
python3 raw_to_png.py /path/to/recordings --width 32 --height 32
```

Enable verbose output:
```bash
python3 raw_to_png.py /tmp --verbose
```

#### PNG to Video Examples

Create video with variable frame rate based on timestamps:
```bash
python3 png_to_video.py /tmp
```

Create video with fixed 10 FPS:
```bash
python3 png_to_video.py /tmp --fps 10 --output recording.mp4
```

Create high-resolution video (8x scaling):
```bash
python3 png_to_video.py /path/to/recordings --scale 8 --output hires_video.mp4
```

### Input/Output Formats

#### Raw to PNG Converter

- **Input**: Raw binary files (e.g., `paa3905-1682899200000.raw`)
- **Output**: PNG images (e.g., `paa3905-1682899200000.raw.png`)
- **Default dimensions**: 35x35 pixels (PAA3905 sensor resolution)

#### PNG to Video Converter

- **Input**: Timestamped PNG files (e.g., `paa3905-1682899200000.raw.png`)
- **Output**: MP4 video with accurate timing
- **Features**: 
  - Automatic timestamp parsing from filenames
  - Variable or fixed frame rates
  - Image scaling for better visibility (35x35 → 140x140 by default)
  - Accurate frame timing based on actual capture timestamps

### Processing Pipeline

The complete workflow for PAA3905 data visualization:

1. **Capture**: Use REST API endpoints to record frames and optical flow data
2. **Convert**: Transform raw frames to PNG images with `raw_to_png.py`
3. **Visualize**: Create time-accurate videos with `png_to_video.py`

Example complete pipeline:
```bash
# 1. Start recording (via API)
curl "http://localhost:3000/api/v1/recording/start?dir=/tmp&timeout=30"

# 2. Stop recording (via API) 
curl "http://localhost:3000/api/v1/recording/stop"

# 3. Convert raw frames to PNG
python3 raw_to_png.py /tmp --verbose

# 4. Create video from PNG files
python3 png_to_video.py /tmp --output session_recording.mp4
```

### Error Handling

The script includes comprehensive error handling for:
- Missing directories or files
- Invalid file sizes
- Corrupted data
- Permission issues
- Invalid command line arguments