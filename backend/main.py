from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import uvicorn
import shutil
import os
import json
from pathlib import Path
from typing import Optional
import uuid
import aiofiles

# Import our ffmpeg setup utility - handle both package and direct run
try:
    from .ffmpeg_utils import add_ffmpeg_to_path
except ImportError:
    from ffmpeg_utils import add_ffmpeg_to_path

# Ensure FFmpeg is available
add_ffmpeg_to_path()

app = FastAPI(title="ShutterCut Video Editing Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/")
def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "ShutterCut Video Editing Backend",
        "version": "1.0.0",
        "endpoints": {
            "upload": "POST /upload",
            "status": "GET /status/{job_id}",
            "result": "GET /result/{job_id}"
        }
    }

# Directories
UPLOAD_DIR = Path("uploads")
RESULT_DIR = Path("results")
UPLOAD_DIR.mkdir(exist_ok=True)
RESULT_DIR.mkdir(exist_ok=True)

# In-memory job store (replace with DB if needed)
jobs = {}

class JobStatus:
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

def update_job_progress(job_id: str, progress: float):
    """Update job progress percentage."""
    if job_id in jobs:
        jobs[job_id]["progress"] = progress

# Import rendering logic - handle both package and direct run
try:
    from .rendering import render_video
except ImportError:
    from rendering import render_video

def process_video(job_id: str, video_path: Path, overlay_assets: list, metadata: list):
    """
    Background task to process video with ffmpeg.
    """
    try:
        jobs[job_id]["status"] = JobStatus.PROCESSING
        jobs[job_id]["progress"] = 0
        output_path = RESULT_DIR / f"{job_id}.mp4"
        
        # Run actual rendering with progress callback
        render_video(job_id, video_path, overlay_assets, metadata, output_path, update_job_progress)
        
        jobs[job_id]["status"] = JobStatus.COMPLETED
        jobs[job_id]["progress"] = 100
        jobs[job_id]["result_path"] = str(output_path)
        print(f"Job {job_id} completed.")
        
    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        jobs[job_id]["status"] = JobStatus.FAILED
        jobs[job_id]["error"] = str(e)

@app.post("/upload")
async def upload_video(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    assets: list[UploadFile] = File(default=[]),
    metadata: str = Form(...)  # JSON string of overlays
):
    print(f"\n{'='*50}")
    print(f"UPLOAD REQUEST RECEIVED")
    print(f"{'='*50}")
    
    try:
        job_id = str(uuid.uuid4())
        
        # Handle filename - web blobs might have None or 'blob' as filename
        video_filename = video.filename if video.filename and video.filename != 'blob' else 'video.mp4'
        video_path = UPLOAD_DIR / f"{job_id}_{video_filename}"
        
        print(f"[{job_id}] Starting upload")
        print(f"[{job_id}] Video filename: {video_filename}")
        print(f"[{job_id}] Metadata length: {len(metadata)} chars")
        print(f"[{job_id}] Number of assets: {len(assets)}")
        
        # Save Main Video using async chunked writing for better performance
        # This prevents blocking the event loop during large file uploads
        CHUNK_SIZE = 1024 * 1024  # 1MB chunks for better throughput
        bytes_written = 0
        async with aiofiles.open(video_path, "wb") as buffer:
            while True:
                chunk = await video.read(CHUNK_SIZE)
                if not chunk:
                    break
                await buffer.write(chunk)
                bytes_written += len(chunk)
                if bytes_written % (10 * CHUNK_SIZE) == 0:  # Log every 10MB
                    print(f"[{job_id}] Video upload progress: {bytes_written / (1024*1024):.1f} MB")
        
        print(f"[{job_id}] Video saved: {bytes_written / (1024*1024):.2f} MB")
        
        # Save Overlay Assets using async I/O
        asset_paths = []
        if assets:
            for idx, asset in enumerate(assets):
                # Handle filename - web blobs might have None or 'blob' as filename  
                asset_filename = asset.filename if asset.filename and asset.filename != 'blob' else f'asset_{idx}.png'
                a_path = UPLOAD_DIR / f"{job_id}_asset_{asset_filename}"
                async with aiofiles.open(a_path, "wb") as buffer:
                    while True:
                        chunk = await asset.read(CHUNK_SIZE)
                        if not chunk:
                            break
                        await buffer.write(chunk)
                asset_paths.append(a_path)
                print(f"[{job_id}] Asset saved: {asset_filename}")
            
        print(f"[{job_id}] Parsing metadata...")
        try:
            overlays = json.loads(metadata)
            
            # Map overlays to the actual saved filenames on disk
            # This ensures rendering.py can find the files in the input list
            for ov in overlays:
                if ov.get("type") in ["image", "video"] and "content" in ov:
                    # The file was saved with this pattern:
                    # UPLOAD_DIR / f"{job_id}_asset_{asset_filename}"
                    input_filename = ov["content"]
                    
                    # Handle the edge case where the file might have been renamed during save?
                    # Since we use the logic: asset_filename = asset.filename ...
                    # And asset.filename comes from formData with name=ov.content
                    # We can safely reconstruct the saved filename:
                    saved_filename = f"{job_id}_asset_{input_filename}"
                    ov["content"] = saved_filename

        except json.JSONDecodeError as e:
            return JSONResponse(
                status_code=400, 
                content={"error": f"Invalid metadata JSON: {str(e)}"}
            )
            
        # Create Job
        jobs[job_id] = {
            "id": job_id,
            "status": JobStatus.QUEUED,
            "original_video": str(video_path),
            "overlays": overlays,
            "progress": 0
        }
        
        # Trigger Background Processing
        background_tasks.add_task(process_video, job_id, video_path, asset_paths, overlays)
        
        print(f"[{job_id}] Job queued successfully!")
        print(f"{'='*50}\n")
        
        return {"job_id": job_id, "status": "queued"}
        
    except Exception as e:
        import traceback
        print(f"Upload error: {e}")
        print(f"Traceback:\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Upload failed: {str(e)}"}
        )

@app.get("/status/{job_id}")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"error": "Job not found"})
    
    return {
        "job_id": job_id, 
        "status": job["status"], 
        "progress": job.get("progress", 0),
        "error": job.get("error")
    }

@app.get("/result/{job_id}")
def get_result(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"error": "Job not found"})
        
    if job["status"] != JobStatus.COMPLETED:
        return JSONResponse(status_code=400, content={"error": "Video not ready", "status": job["status"]})
        
    return FileResponse(job["result_path"], media_type="video/mp4", filename="edited_video.mp4")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
