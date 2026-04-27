# PAA3905 Tools

This directory contains utility scripts for working with PAA3905 sensor data.

## Raw to PNG Converter

The `raw_to_png.py` script converts raw binary frame files captured from the PAA3905 sensor into PNG images for visualization and analysis.

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
pip install --user Pillow numpy
```

### Usage

Convert all .raw files in a directory:

```bash
python3 raw_to_png.py <directory> [--width WIDTH] [--height HEIGHT]
```

### Examples

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

### Input/Output Format

- **Input**: Raw binary files (e.g., `paa3905-1682899200000.raw`)
- **Output**: PNG images (e.g., `paa3905-1682899200000.raw.png`)
- **Default dimensions**: 35x35 pixels (PAA3905 sensor resolution)

The script automatically:
- Finds all `*.raw` files in the specified directory
- Validates file sizes match expected dimensions
- Converts grayscale pixel data to PNG format
- Preserves original filenames with `.png` extension added

### Error Handling

The script includes comprehensive error handling for:
- Missing directories or files
- Invalid file sizes
- Corrupted data
- Permission issues
- Invalid command line arguments