#!/usr/bin/env python3
"""
PAA3905 PNG to Video Converter

This script converts timestamped PNG files from PAA3905 sensor recordings
into MP4 video files with accurate frame timing based on epoch timestamps.

Usage:
    python3 png_to_video.py <directory> [--output VIDEO.mp4] [--fps FPS]
    python3 png_to_video.py /tmp --output paa3905_recording.mp4 --fps 10

The script reads PNG files with pattern: paa3905-{epoch-time}.raw.png
and creates a video with proper frame timing based on the actual timestamps.
"""

import argparse
import os
import sys
import glob
import re
from pathlib import Path
import numpy as np
import cv2
from datetime import datetime, timezone

def extract_timestamp_from_filename(filename):
    """
    Extract epoch timestamp from PAA3905 PNG filename.
    
    Args:
        filename (str): Filename like 'paa3905-1682899200000.raw.png'
        
    Returns:
        int: Epoch timestamp in milliseconds, or None if not found
    """
    # Pattern: paa3905-{epoch-time}.raw.png
    pattern = r'paa3905-(\d+)\.raw\.png$'
    match = re.search(pattern, os.path.basename(filename))
    
    if match:
        return int(match.group(1))
    return None

def load_and_sort_frames(directory):
    """
    Load PNG frames from directory and sort by timestamp.
    
    Args:
        directory (str): Directory containing PNG files
        
    Returns:
        list: List of tuples (timestamp_ms, filepath, image)
    """
    print(f"🔍 Searching for PNG files in: {directory}")
    
    # Find all PNG files matching pattern
    pattern = os.path.join(directory, 'paa3905-*.raw.png')
    png_files = glob.glob(pattern)
    
    if not png_files:
        raise FileNotFoundError(f"No PNG files found matching pattern: paa3905-*.raw.png")
    
    print(f"📁 Found {len(png_files)} PNG files")
    
    frames = []
    failed_files = []
    
    for png_file in png_files:
        try:
            # Extract timestamp
            timestamp = extract_timestamp_from_filename(png_file)
            if timestamp is None:
                failed_files.append(png_file)
                continue
            
            # Load image
            image = cv2.imread(png_file, cv2.IMREAD_GRAYSCALE)
            if image is None:
                failed_files.append(png_file)
                continue
            
            frames.append((timestamp, png_file, image))
            
        except Exception as e:
            print(f"⚠️  Failed to process {os.path.basename(png_file)}: {e}")
            failed_files.append(png_file)
    
    if failed_files:
        print(f"❌ Failed to process {len(failed_files)} files")
    
    if not frames:
        raise ValueError("No valid frames could be loaded")
    
    # Sort by timestamp
    frames.sort(key=lambda x: x[0])
    
    print(f"✅ Loaded and sorted {len(frames)} frames")
    
    # Print timing info
    start_time = frames[0][0]
    end_time = frames[-1][0]
    duration_ms = end_time - start_time
    
    start_dt = datetime.fromtimestamp(start_time / 1000, tz=timezone.utc)
    end_dt = datetime.fromtimestamp(end_time / 1000, tz=timezone.utc)
    
    print(f"📅 Recording period: {start_dt.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} UTC")
    print(f"   to {end_dt.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} UTC")
    print(f"⏱️  Total duration: {duration_ms/1000:.3f} seconds")
    
    return frames

def calculate_frame_durations(frames, target_fps=None):
    """
    Calculate frame durations based on timestamps or target FPS.
    
    Args:
        frames (list): List of (timestamp, filepath, image) tuples
        target_fps (float, optional): Target FPS for uniform timing
        
    Returns:
        list: List of frame durations in seconds
    """
    if len(frames) < 2:
        return [1.0]  # Single frame, 1 second duration
    
    if target_fps:
        # Uniform frame rate
        frame_duration = 1.0 / target_fps
        durations = [frame_duration] * len(frames)
        print(f"🎬 Using uniform frame rate: {target_fps} FPS ({frame_duration:.3f}s per frame)")
    else:
        # Variable frame rate based on actual timestamps
        durations = []
        
        for i in range(len(frames) - 1):
            current_timestamp = frames[i][0]
            next_timestamp = frames[i + 1][0]
            duration_ms = next_timestamp - current_timestamp
            duration_s = duration_ms / 1000.0
            
            # Clamp duration to reasonable range (0.001s to 10s)
            duration_s = max(0.001, min(10.0, duration_s))
            durations.append(duration_s)
        
        # Last frame duration (use average or minimum duration)
        if durations:
            avg_duration = sum(durations) / len(durations)
            durations.append(avg_duration)
        else:
            durations.append(0.1)  # 100ms default
        
        avg_fps = 1.0 / (sum(durations) / len(durations))
        print(f"🎬 Using variable frame rate based on timestamps (avg: {avg_fps:.2f} FPS)")
    
    return durations

def create_video(frames, durations, output_path, scale_factor=4):
    """
    Create MP4 video from frames with specified durations.
    
    Args:
        frames (list): List of (timestamp, filepath, image) tuples
        durations (list): List of frame durations in seconds
        output_path (str): Output video file path
        scale_factor (int): Scale factor for tiny images (35x35 -> 140x140)
    """
    if not frames:
        raise ValueError("No frames to process")
    
    print(f"🎥 Creating video: {output_path}")
    
    # Get image dimensions (scale up tiny images for better visibility)
    first_image = frames[0][2]
    height, width = first_image.shape
    
    # Scale up if image is small (like 35x35 PAA3905 frames)
    if width <= 64 or height <= 64:
        new_width = width * scale_factor
        new_height = height * scale_factor
        print(f"📐 Scaling frames from {width}x{height} to {new_width}x{new_height}")
    else:
        new_width, new_height = width, height
    
    # Video codec and writer setup
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    
    # Calculate average FPS for video container (OpenCV needs a fixed FPS)
    total_duration = sum(durations)
    avg_fps = len(frames) / total_duration if total_duration > 0 else 10.0
    
    # Clamp FPS to reasonable range
    avg_fps = max(1.0, min(60.0, avg_fps))
    
    print(f"📹 Video settings: {new_width}x{new_height}, {avg_fps:.2f} FPS, {total_duration:.3f}s")
    
    # Create video writer
    video_writer = cv2.VideoWriter(output_path, fourcc, avg_fps, (new_width, new_height), False)
    
    if not video_writer.isOpened():
        raise RuntimeError(f"Failed to create video writer for {output_path}")
    
    try:
        total_frames_written = 0
        
        for i, ((timestamp, filepath, image), duration) in enumerate(zip(frames, durations)):
            # Scale image if needed
            if width != new_width or height != new_height:
                # Use nearest neighbor for crisp pixel art look
                scaled_image = cv2.resize(image, (new_width, new_height), 
                                        interpolation=cv2.INTER_NEAREST)
            else:
                scaled_image = image
            
            # Calculate how many times to repeat this frame based on duration and target FPS
            repeat_count = max(1, int(duration * avg_fps))
            
            # Write frame multiple times to achieve desired duration
            for _ in range(repeat_count):
                video_writer.write(scaled_image)
                total_frames_written += 1
            
            # Progress indication
            if (i + 1) % 50 == 0 or i == len(frames) - 1:
                progress = (i + 1) / len(frames) * 100
                print(f"⏳ Progress: {progress:.1f}% ({i + 1}/{len(frames)} frames)")
        
        print(f"✅ Video creation complete: {total_frames_written} total frames written")
        
    finally:
        video_writer.release()

def main():
    """
    Main function to handle command line arguments and video creation.
    """
    parser = argparse.ArgumentParser(
        description='Convert timestamped PAA3905 PNG files to MP4 video',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 png_to_video.py /tmp
  python3 png_to_video.py /path/to/recordings --output recording.mp4
  python3 png_to_video.py ./data --fps 10 --output fixed_fps.mp4

Input files: paa3905-{epoch-time}.raw.png
Output: MP4 video with accurate timing or fixed frame rate
        """
    )
    
    parser.add_argument(
        'directory',
        help='Directory containing PNG files to convert'
    )
    
    parser.add_argument(
        '--output', '-o',
        default='paa3905_video.mp4',
        help='Output video filename (default: paa3905_video.mp4)'
    )
    
    parser.add_argument(
        '--fps',
        type=float,
        help='Force fixed frame rate (default: use variable rate based on timestamps)'
    )
    
    parser.add_argument(
        '--scale',
        type=int,
        default=4,
        help='Scale factor for small images (default: 4, 35x35 becomes 140x140)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.fps and args.fps <= 0:
        print("Error: FPS must be positive", file=sys.stderr)
        sys.exit(1)
    
    if args.scale <= 0:
        print("Error: Scale factor must be positive", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Load and sort frames by timestamp
        frames = load_and_sort_frames(args.directory)
        
        # Calculate frame durations
        durations = calculate_frame_durations(frames, args.fps)
        
        # Create output path
        output_path = os.path.abspath(args.output)
        
        # Create video
        create_video(frames, durations, output_path, args.scale)
        
        # Final summary
        file_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
        print(f"\n🎉 Video created successfully!")
        print(f"📁 Output file: {output_path}")
        print(f"📊 File size: {file_size:.2f} MB")
        print(f"🎬 Frames: {len(frames)}")
        print(f"⏱️  Duration: {sum(durations):.3f} seconds")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()