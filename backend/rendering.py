import subprocess
import json
import shlex
import os
from pathlib import Path

# Handle both package and direct run imports
try:
    from .ffmpeg_utils import FFMPEG_EXE
except ImportError:
    from ffmpeg_utils import FFMPEG_EXE

def build_filter_complex(inputs, overlays):
    """
    Constructs the ffmpeg filter complex string.
    inputs: list of file paths (0 is main video)
    overlays: list of dicts with keys: type, content, x, y, start, end
             'content' for Image/Video should match a filename in inputs or be a text string
    """
    filter_chains = []
    
    # Map filenames to input indices
    # inputs[0] is main video
    # inputs[1...] are overlay assets
    file_map = {Path(p).name: i for i, p in enumerate(inputs)}
    
    # We maintain a 'current' video stream label, starting with [0:v]
    current_stream = "[0:v]"
    
    for i, ov in enumerate(overlays):
        ov_type = ov.get("type", "text")
        start = float(ov.get("start", 0))
        end = float(ov.get("end", 5)) # Default duration
        x = int(ov.get("x", 0))
        y = int(ov.get("y", 0))
        
        # Enable expression: "between(t, start, end)"
        enable_expr = f"enable='between(t,{start},{end})'"
        
        output_label = f"[v{i+1}]"
        
        if ov_type == "text":
            text = ov.get("content", "Text")
            # Text overlay using drawtext
            font_size = int(ov.get("fontSize", 24))
            font_color = ov.get("color", "white")
            
            # Clean color - remove # if present
            if font_color.startswith("#"):
                font_color = font_color[1:]
            
            # Escape text for ffmpeg - escape special characters
            safe_text = text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
            
            filter_cmd = (
                f"{current_stream}drawtext=text='{safe_text}':"
                f"x={x}:y={y}:fontsize={font_size}:fontcolor=0x{font_color}:"
                f"{enable_expr}{output_label}"
            )
            filter_chains.append(filter_cmd)
            current_stream = output_label
            
        elif ov_type == "image":
            # Image overlay with optional scaling
            filename = ov.get("content")
            input_idx = file_map.get(filename)
            
            if input_idx is None:
                print(f"Warning: Asset {filename} not found in inputs.")
                continue
            
            # Check if custom width/height specified
            width = ov.get("width")
            height = ov.get("height")
            
            if width and height:
                # Scale the image first, then overlay
                scaled_label = f"[scaled{i}]"
                scale_cmd = f"[{input_idx}:v]scale={width}:{height}{scaled_label}"
                filter_chains.append(scale_cmd)
                
                filter_cmd = (
                    f"{current_stream}{scaled_label}overlay="
                    f"x={x}:y={y}:{enable_expr}{output_label}"
                )
            else:
                # No scaling, overlay directly
                filter_cmd = (
                    f"{current_stream}[{input_idx}:v]overlay="
                    f"x={x}:y={y}:{enable_expr}{output_label}"
                )
            
            filter_chains.append(filter_cmd)
            current_stream = output_label

        elif ov_type == "video":
            # Video overlay with optional scaling
            filename = ov.get("content")
            input_idx = file_map.get(filename)
            
            if input_idx is None:
                print(f"Warning: Asset {filename} not found in inputs.")
                continue
            
            # Check if custom width/height specified
            width = ov.get("width")
            height = ov.get("height")
            
            if width and height:
                # Scale the video first, then overlay
                scaled_label = f"[scaled{i}]"
                scale_cmd = f"[{input_idx}:v]scale={width}:{height}{scaled_label}"
                filter_chains.append(scale_cmd)
                
                filter_cmd = (
                    f"{current_stream}{scaled_label}overlay="
                    f"x={x}:y={y}:{enable_expr}{output_label}"
                )
            else:
                # No scaling, overlay directly
                filter_cmd = (
                    f"{current_stream}[{input_idx}:v]overlay="
                    f"x={x}:y={y}:{enable_expr}{output_label}"
                )
            
            filter_chains.append(filter_cmd)
            current_stream = output_label

    return ";".join(filter_chains), current_stream

def render_video(job_id, main_video, overlay_assets, overlays, output_path, progress_callback=None):
    """
    Runs the ffmpeg command.
    main_video: Path to main video
    overlay_assets: List of paths to overlay images/videos
    overlays: List of overlay metadata dicts
    output_path: Path to save result
    progress_callback: Function to call with progress updates (job_id, percentage)
    """
    
    # Get video duration for progress calculation
    duration = get_video_duration(main_video)
    print(f"Video duration: {duration}s")
    
    # Prepare inputs
    inputs = [main_video] + overlay_assets
    input_args = []
    for inp in inputs:
        input_args.extend(["-i", str(inp)])
        
    # Build filter complex
    filter_str, final_map = build_filter_complex(inputs, overlays)
    
    print(f"Filter complex: {filter_str}")
    print(f"Final map: {final_map}")
    
    cmd = [str(FFMPEG_EXE), "-y"] + input_args
    
    if filter_str:
        # With overlays - need to re-encode
        cmd.extend(["-filter_complex", filter_str, "-map", final_map, "-map", "0:a?"])
        cmd.extend(["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart"])
    else:
        # No overlays, just copy
        cmd.extend(["-c", "copy", "-movflags", "+faststart"])
    
    cmd.append(str(output_path))
    
    print(f"Running FFmpeg: {' '.join(cmd)}")
    
    # Run FFmpeg and capture output with progress tracking
    try:
        process = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT,  # Redirect stderr to stdout
            universal_newlines=True,
            bufsize=1
        )
        
        # Track progress by reading output in real-time
        output_lines = []
        while True:
            line = process.stdout.readline()
            if not line:
                break
            output_lines.append(line)
            print(line.rstrip())  # Print progress in real-time
            
            # Parse FFmpeg progress from output (time=00:00:10.50)
            if 'time=' in line and duration > 0:
                try:
                    time_str = line.split('time=')[1].split()[0]
                    # Parse time format HH:MM:SS.ms
                    parts = time_str.split(':')
                    if len(parts) == 3:
                        hours = float(parts[0])
                        minutes = float(parts[1])
                        seconds = float(parts[2])
                        current_time = hours * 3600 + minutes * 60 + seconds
                        progress_pct = min(99, (current_time / duration) * 100)
                        if progress_callback:
                            progress_callback(job_id, progress_pct)
                except Exception as e:
                    pass
        
        process.wait()
        output = ''.join(output_lines)
        
        print(f"FFmpeg output (last 1000 chars): {output[-1000:]}")
        
        if process.returncode != 0:
            error_msg = f"FFmpeg failed (code {process.returncode}): {output[-1000:]}"
            print(error_msg)
            raise Exception(error_msg)
        
        # Verify output file exists and has content
        if not output_path.exists() or output_path.stat().st_size < 100:
            raise Exception(f"Output file is empty or missing. FFmpeg output: {output[-500:]}")
        
        # Set to 100% on completion
        if progress_callback:
            progress_callback(job_id, 100)
            
        print(f"Render complete: {output_path} ({output_path.stat().st_size} bytes)")
        return output_path
        
    except Exception as e:
        print(f"Render error: {e}")
        raise

def get_video_duration(video_path):
    """Get video duration in seconds using ffprobe."""
    try:
        try:
            from .ffmpeg_utils import FFPROBE_EXE
        except ImportError:
            from ffmpeg_utils import FFPROBE_EXE
        cmd = [
            str(FFPROBE_EXE),
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except Exception as e:
        print(f"Error getting video duration: {e}")
    return 10  # Default to 10 seconds if we can't determine duration
