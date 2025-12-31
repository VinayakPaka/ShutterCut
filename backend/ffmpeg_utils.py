import os
import sys
import zipfile
import requests
import shutil
from pathlib import Path

# Constants
FFMPEG_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
BACKEND_DIR = Path(__file__).parent.absolute()
BIN_DIR = BACKEND_DIR / "bin"
FFMPEG_EXE = BIN_DIR / "ffmpeg.exe"
FFPROBE_EXE = BIN_DIR / "ffprobe.exe"

def setup_ffmpeg():
    """
    Checks if ffmpeg is present in 'bin'. If not, downloads and extracts it.
    Returns the directory containing the binaries to add to PATH.
    """
    if FFMPEG_EXE.exists() and FFPROBE_EXE.exists():
        print(f"FFmpeg found at {FFMPEG_EXE}")
        return str(BIN_DIR)
    
    print("FFmpeg not found. Downloading portable version...")
    try:
        BIN_DIR.mkdir(parents=True, exist_ok=True)
        zip_path = BIN_DIR / "ffmpeg.zip"
        
        # Download
        with requests.get(FFMPEG_URL, stream=True) as r:
            r.raise_for_status()
            with open(zip_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        
        print("Download complete. Extracting...")
        
        # Extract
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # The zip usually contains a root folder like 'ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe'
            # We need to flatten this.
            for file in zip_ref.namelist():
                if file.endswith("bin/ffmpeg.exe"):
                    source = zip_ref.open(file)
                    with open(FFMPEG_EXE, "wb") as target:
                        shutil.copyfileobj(source, target)
                elif file.endswith("bin/ffprobe.exe"):
                    source = zip_ref.open(file)
                    with open(FFPROBE_EXE, "wb") as target:
                        shutil.copyfileobj(source, target)
                        
        # Cleanup
        os.remove(zip_path)
        print("FFmpeg setup complete.")
        return str(BIN_DIR)

    except Exception as e:
        print(f"Error setting up FFmpeg: {e}")
        # Setup failed, maybe clean up?
        return None

def add_ffmpeg_to_path():
    bin_path = setup_ffmpeg()
    if bin_path and bin_path not in os.environ["PATH"]:
        os.environ["PATH"] += os.pathsep + bin_path
        print(f"Added {bin_path} to PATH")

if __name__ == "__main__":
    setup_ffmpeg()
