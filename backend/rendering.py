import subprocess
import json
import shlex
import os
from pathlib import Path
from .ffmpeg_utils import FFMPEG_EXE

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
        x = ov.get("x", 0)
        y = ov.get("y", 0)
        
        # Enable expression: "between(t, start, end)"
        enable_expr = f"enable='between(t,{start},{end})'"
        
        output_label = f"[v{i+1}]"
        
        if ov_type == "text":
            text = ov.get("content", "Text")
            # Text overlay using drawtext
            # usage: [prev]drawtext=...[next]
            # Need fontfile ideally, or use default
            font_size = ov.get("fontSize", 24)
            font_color = ov.get("color", "white")
            
            # Escape text for ffmpeg
            safe_text = text.replace(":", "\\:").replace("'", "'") 
            
            filter_cmd = (
                f"{current_stream}drawtext=text='{safe_text}':"
                f"x={x}:y={y}:fontsize={font_size}:fontcolor={font_color}:"
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
    
    # Prepare inputs
    inputs = [main_video] + overlay_assets
    input_args = []
    for inp in inputs:
        input_args.extend(["-i", str(inp)])
        
    # Build filter complex
    filter_str, final_map = build_filter_complex(inputs, overlays)
    
    cmd = [str(FFMPEG_EXE), "-y", "-progress", "pipe:1"] + input_args
    
    if filter_str:
        # With overlays - need to re-encode
        cmd.extend(["-filter_complex", filter_str, "-map", final_map, "-map", "0:a?"])
        cmd.extend(["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-c:a", "copy"])
    else:
        # No overlays, just copy
        cmd.extend(["-c", "copy"])
    
    cmd.append(str(output_path))
    
    print(f"Running FFmpeg: {' '.join(cmd)}")
    
    # Run with progress tracking
    process = subprocess.Popen(
        cmd, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.PIPE, 
        universal_newlines=True,
        bufsize=1
    )
    
    # Collect stderr in background
    stderr_output = []
    
    # Parse progress from stdout
    for line in process.stdout:
        if line.startswith("out_time_ms="):
            try:
                time_ms = int(line.split("=")[1].strip())
                time_sec = time_ms / 1000000.0
                if duration > 0 and progress_callback:
                    progress = min(99, int((time_sec / duration) * 100))
                    progress_callback(job_id, progress)
            except:
                pass
    
    # Wait for process to finish and get stderr
    _, stderr = process.communicate()
    
    if process.returncode != 0:
        print(f"FFmpeg Error (code {process.returncode}):")
        print(stderr)
        raise Exception(f"FFmpeg failed: {stderr[:500]}")
    
    # Set to 100% on completion
    if progress_callback:
        progress_callback(job_id, 100)
        
    return output_path

def get_video_duration(video_path):
    """Get video duration in seconds using ffprobe."""
    try:
        from .ffmpeg_utils import FFPROBE_EXE
        cmd = [
            str(FFPROBE_EXE),
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return float(result.stdout.strip())
    except:
        pass
    return 0
