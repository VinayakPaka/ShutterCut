
import os
from pathlib import Path
import json

# Mocking rendering.py functions to isolate logic
def build_filter_complex(inputs, overlays):
    file_map = {Path(p).name: i for i, p in enumerate(inputs)}
    print(f"File Map: {file_map}")
    
    current_stream = "[0:v]"
    filter_chains = []
    
    for i, ov in enumerate(overlays):
        ov_type = ov.get("type", "text")
        start = float(ov.get("start", 0))
        end = float(ov.get("end", 5))
        x = int(ov.get("x", 0))
        y = int(ov.get("y", 0))
        enable_expr = f"enable='between(t,{start},{end})'"
        output_label = f"[v{i+1}]"
        
        if ov_type == "image":
            filename = ov.get("content")
            print(f"Processing overlay: {filename}")
            input_idx = file_map.get(filename)
            
            if input_idx is None:
                print(f"ERROR: Asset {filename} not found in inputs keys: {list(file_map.keys())}")
                continue
            
            print(f"Found input_idx: {input_idx}")
            
            width = ov.get("width")
            height = ov.get("height")
            
            if width and height:
                scaled_label = f"[scaled{i}]"
                scale_cmd = f"[{input_idx}:v]scale={width}:{height}{scaled_label}"
                filter_chains.append(scale_cmd)
                filter_cmd = f"{current_stream}{scaled_label}overlay=x={x}:y={y}:{enable_expr}{output_label}"
            else:
                filter_cmd = f"{current_stream}[{input_idx}:v]overlay=x={x}:y={y}:{enable_expr}{output_label}"
            
            filter_chains.append(filter_cmd)
            current_stream = output_label

    return ";".join(filter_chains)

# Simulation
def test_logic():
    job_id = "test_job"
    
    # Simulate Frontend Data
    overlays_metadata = [
        {
            "id": "1", 
            "type": "image", 
            "content": "image_123.png", 
            "x": 50, 
            "y": 50, 
            "start": 0, 
            "end": 5,
            "width": 100,
            "height": 100
        }
    ]
    
    # Simulate Main.py Logic
    video_path = Path("uploads") / f"{job_id}_video.mp4"
    
    # Asset uploaded
    asset_filename = "image_123.png" # From upload
    saved_asset_path = Path("uploads") / f"{job_id}_asset_{asset_filename}"
    
    asset_paths = [saved_asset_path]
    
    # Metadata mapping in main.py
    for ov in overlays_metadata:
        if ov.get("type") in ["image", "video"] and "content" in ov:
            input_filename = ov["content"]
            saved_filename = f"{job_id}_asset_{input_filename}"
            print(f"Mapping '{input_filename}' to '{saved_filename}'")
            ov["content"] = saved_filename
            
    # Simulate Render Call
    inputs = [video_path] + asset_paths
    
    print("\n--- Running Build Filter Complex ---")
    filter_result = build_filter_complex(inputs, overlays_metadata)
    print(f"\nResult: {filter_result}")

if __name__ == "__main__":
    test_logic()
