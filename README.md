# ShutterCut Video Editing App

A full-stack video editing application built with React Native (Expo) and FastAPI (Python).

## Features
- **Upload & Edit**: Select videos from your device.
- **Multiple Overlay Types**: Add Text, Image, and Video overlays.
- **Interactive Editor**: Drag and drop overlays on the video preview.
- **Timing Control**: Set start and end times for each overlay.
- **Real-time Progress**: Track video rendering progress with percentage updates.
- **Cloud Rendering**: Backend processing using FFmpeg to burn overlays.
- **Portable FFmpeg**: The backend automatically sets up a portable FFmpeg binary (Windows).
- **Docker Support**: Run the entire stack with Docker containers.

## Project Structure
- `/frontend`: React Native Expo project.
- `/backend`: FastAPI Python server.
- `/docker-compose.yml`: Docker orchestration for both services.

## Setup Instructions

### Prerequisites
- Node.js & npm
- Python 3.8+
- Expo Go app on your mobile device (or Android Studio / Xcode Simulator)

### 1. Backend Setup
The backend handles video storage and processing.

1. Navigate to the root directory.
2. Install Python dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Start the server:
   ```bash
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```
   *Note: On first run, it will download a portable FFmpeg (~80MB), which may take a minute.*

### 2. Frontend Setup
The frontend is the mobile editor interface.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies (if not already done):
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npx expo start
   ```
4. Scan the QR code with the **Expo Go** app (Android/iOS) or press `a` for Android Emulator / `i` for iOS Simulator.

> **Note for Android Emulator**: The app connects to `http://10.0.2.2:8000`.
> **Note for Physical Device**: You must change `API_URL` in `frontend/src/screens/EditorScreen.js` to your computer's local IP address (e.g., `http://192.168.1.5:8000`).

## Usage
1. Open the App.
2. Tap "Tap to Select Video".
3. Use "+ Text", "+ Image", or "+ Video" to add overlays.
4. Drag overlays to position them on the video.
5. Tap on an overlay to select it and adjust timing (start/end).
6. Tap "Export" to send for processing.
7. Watch the real-time progress percentage.
8. Download the result when rendering is complete.

## Docker Setup (Alternative)

### Quick Start with Docker
1. Build and run all services:
   ```bash
   docker-compose up --build
   ```

2. The backend will be available at `http://localhost:8000`
3. The frontend Expo server will run on port `8081`
4. Scan the QR code with Expo Go app to connect

### Individual Docker Commands
```bash
# Build backend only
docker build -t shuttercut-backend ./backend

# Build frontend only
docker build -t shuttercut-frontend ./frontend

# Run backend
docker run -p 8000:8000 -v $(pwd)/uploads:/app/uploads -v $(pwd)/results:/app/results shuttercut-backend

# Run frontend
docker run -p 8081:8081 shuttercut-frontend
```

## API Endpoints

### `POST /upload`
Uploads video and metadata.
- **Multipart Form Data**:
  - `video`: The video file.
  - `assets`: (Optional) Image/Video overlay files.
  - `metadata`: JSON string of overlay configurations.
- **Returns**: `{"job_id": "uuid", "status": "queued"}`

### `GET /status/{job_id}`
Returns processing status and progress.
- **Returns**: `{"job_id": "uuid", "status": "processing", "progress": 45}`
- **Status values**: `queued`, `processing`, `completed`, `failed`
- **Progress**: Integer 0-100 (percentage complete)

### `GET /result/{job_id}`
Returns the rendered video file.
- **Returns**: Video file (MP4) for download

## Technical Details

### Backend Processing
- FFmpeg with filter_complex for overlay composition
- Progress tracking via FFmpeg's `-progress` flag
- Background task processing with FastAPI BackgroundTasks
- Support for text (drawtext), image, and video overlays
- Timing control with enable expressions

### Frontend Features
- Expo Image Picker for media selection
- React Native Gesture Handler for drag-and-drop
- Video preview with expo-av
- Axios for HTTP multipart uploads
- Real-time polling for job status updates

### Overlay Metadata Format
```json
[
  {
    "id": "unique_id",
    "type": "text|image|video",
    "content": "text_content or filename",
    "x": 50,
    "y": 100,
    "start": 0.0,
    "end": 5.0,
    "color": "#FFFFFF",
    "fontSize": 24
  }
]
```

---
Built by Antigravity Agent.
