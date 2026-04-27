#!/usr/bin/env python3
"""
PAA3905 Raw Frame to PNG Converter

This script converts raw binary frame files captured from PAA3905 sensor
to PNG image files for visualization and analysis.

Usage:
    python3 raw_to_png.py <directory> [--width WIDTH] [--height HEIGHT]
    python3 raw_to_png.py /tmp --width 35 --height 35

The script searches for all *.raw files in the specified directory and converts
them to PNG format with the filename pattern: original_name.raw.png
"""

import argparse
import os
import sys
import glob
from pathlib import Path
import numpy as np
from PIL import Image

def convert_raw_to_png(raw_file_path, width, height, output_path=None):
    """
    Convert a single raw binary file to PNG format.
    
    Args:
        raw_file_path (str): Path to the input .raw file
        width (int): Image width in pixels
        height (int): Image height in pixels
        output_path (str, optional): Output PNG file path. If None, uses input path + .png
    
    Returns:
        str: Path to the created PNG file
    
    Raises:
        FileNotFoundError: If input file doesn't exist
        ValueError: If file size doesn't match expected dimensions
        IOError: If there's an error reading/writing files
    """
    try:
        # Read raw binary data
        with open(raw_file_path, 'rb') as f:
            raw_data = f.read()
        
        # Verify file size matches expected dimensions
        expected_size = width * height
        if len(raw_data) != expected_size:
            raise ValueError(
                f"File size mismatch: expected {expected_size} bytes "
                f"for {width}x{height}, got {len(raw_data)} bytes"
            )
        
        # Convert bytes to numpy array
        pixel_array = np.frombuffer(raw_data, dtype=np.uint8)
        
        # Reshape to 2D image array
        image_array = pixel_array.reshape((height, width))
        
        # Create PIL Image from array
        image = Image.fromarray(image_array, mode='L')  # 'L' for grayscale
        
        # Determine output path
        if output_path is None:
            output_path = raw_file_path + '.png'
        
        # Save as PNG
        image.save(output_path, 'PNG')
        
        return output_path
        
    except FileNotFoundError:
        raise FileNotFoundError(f"Input file not found: {raw_file_path}")
    except Exception as e:
        raise IOError(f"Error processing {raw_file_path}: {str(e)}")

def find_raw_files(directory):
    """
    Find all .raw files in the specified directory.
    
    Args:
        directory (str): Directory path to search
        
    Returns:
        list: List of .raw file paths
    """
    if not os.path.isdir(directory):
        raise NotADirectoryError(f"Directory not found: {directory}")
    
    # Use glob to find all .raw files
    pattern = os.path.join(directory, '*.raw')
    raw_files = glob.glob(pattern)
    
    return sorted(raw_files)

def main():
    """
    Main function to handle command line arguments and batch conversion.
    """
    parser = argparse.ArgumentParser(
        description='Convert PAA3905 raw frame files to PNG images',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 raw_to_png.py /tmp
  python3 raw_to_png.py /path/to/recordings --width 35 --height 35
  python3 raw_to_png.py ./data --width 32 --height 32

The script will create PNG files with the naming pattern:
  paa3905-1234567890.raw -> paa3905-1234567890.raw.png
        """
    )
    
    parser.add_argument(
        'directory',
        help='Directory containing .raw files to convert'
    )
    
    parser.add_argument(
        '--width',
        type=int,
        default=35,
        help='Image width in pixels (default: 35 for PAA3905)'
    )
    
    parser.add_argument(
        '--height',
        type=int,
        default=35,
        help='Image height in pixels (default: 35 for PAA3905)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.width <= 0 or args.height <= 0:
        print("Error: Width and height must be positive integers", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Find all .raw files in the directory
        raw_files = find_raw_files(args.directory)
        
        if not raw_files:
            print(f"No .raw files found in directory: {args.directory}")
            return
        
        print(f"Found {len(raw_files)} .raw files in {args.directory}")
        print(f"Converting to PNG format ({args.width}x{args.height})...")
        
        # Convert each file
        successful_conversions = 0
        failed_conversions = 0
        
        for raw_file in raw_files:
            try:
                output_path = convert_raw_to_png(raw_file, args.width, args.height)
                successful_conversions += 1
                
                if args.verbose:
                    file_size = os.path.getsize(raw_file)
                    print(f"✅ {os.path.basename(raw_file)} ({file_size} bytes) -> {os.path.basename(output_path)}")
                
            except Exception as e:
                failed_conversions += 1
                print(f"❌ Failed to convert {os.path.basename(raw_file)}: {str(e)}", file=sys.stderr)
        
        # Summary
        print(f"\nConversion complete:")
        print(f"  ✅ Successfully converted: {successful_conversions} files")
        if failed_conversions > 0:
            print(f"  ❌ Failed conversions: {failed_conversions} files")
        
        if successful_conversions > 0:
            print(f"\nPNG files saved in: {args.directory}")
            if not args.verbose and successful_conversions > 5:
                # Show a few example outputs
                example_files = [os.path.basename(f) + '.png' for f in raw_files[:3]]
                print(f"Example outputs: {', '.join(example_files)}")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()