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

# Import our ffmpeg setup utility
from .ffmpeg_utils import add_ffmpeg_to_path

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

# Import rendering logic
from .rendering import render_video

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
    try:
        job_id = str(uuid.uuid4())
        video_path = UPLOAD_DIR / f"{job_id}_{video.filename}"
        
        # Save Main Video
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
        
        # Save Overlay Assets
        asset_paths = []
        if assets:
            for asset in assets:
                a_path = UPLOAD_DIR / f"{job_id}_asset_{asset.filename}"
                with open(a_path, "wb") as buffer:
                    shutil.copyfileobj(asset.file, buffer)
                asset_paths.append(a_path)
            
        try:
            overlays = json.loads(metadata)
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
        
        return {"job_id": job_id, "status": "queued"}
        
    except Exception as e:
        print(f"Upload error: {e}")
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
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
