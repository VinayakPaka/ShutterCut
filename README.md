<div align="center">
  <img src="logo.svg" alt="ShutterCut Logo" width="150" height="150">
  
  # ShutterCut Video Editing App
  
  **Full-Stack Assignment – Buttercut.ai**
  
  [![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-54.0-000020.svg)](https://expo.dev/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688.svg)](https://fastapi.tiangolo.com/)
  [![Python](https://img.shields.io/badge/Python-3.8+-3776AB.svg)](https://www.python.org/)
  [![FFmpeg](https://img.shields.io/badge/FFmpeg-Powered-007808.svg)](https://ffmpeg.org/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
</div>

---

## 📖 Overview

A full-stack video editing application where users can upload videos, overlay texts/clips/images, and render the edited video on the backend. Built with React Native (Expo) and FastAPI (Python) with FFmpeg for video processing.

### 🎯 Implemented Features

✅ **Frontend (React Native + Expo)**
- Video upload/selection from device storage
- Add overlays (text, images, video clips) on top of videos
- Drag & drop positioning for overlays
- Timing controls (start_time, end_time) for each overlay
- Video preview with overlays (frontend-only)
- Submit functionality to send video + metadata to backend

✅ **Backend (FastAPI + FFmpeg)**
- `POST /upload` - Upload video and overlay metadata
- `GET /status/{job_id}` - Check processing status with progress percentage
- `GET /result/{job_id}` - Download final rendered video
- Asynchronous video processing with FFmpeg
- Progress tracking during rendering

✅ **Others**
- 🐳 Docker support for both frontend and backend- 📊 Real-time progress updates (% complete)
- 🎨 Multiple overlay types (text + image + video)
- 🎯 Professional UI/UX with dark theme

## ✨ Features

### 🎬 Video Editing Capabilities
- **📤 Video Upload**: Select videos from device storage or camera roll
- **🎨 Multiple Overlay Types**: 
  - ✏️ Text overlays with custom styling
  - 🖼️ Image overlays
  - 🎥 Video clip overlays
- **🖱️ Interactive Positioning**: Drag and drop overlays anywhere on the video canvas
- **⏱️ Precise Timing Control**: 
  - Set start time (when overlay appears)
  - Set end time (when overlay disappears)
- **👁️ Real-time Preview**: See overlay positions before rendering
- **📱 Mobile-Optimized UI**: Beautiful dark theme with intuitive controls

### ⚡ Backend Processing
- **📊 Job-Based Processing**: Async video rendering with unique job IDs
- **📈 Progress Tracking**: Real-time percentage updates during rendering
- **🎬 FFmpeg Integration**: Professional-grade video processing
- **💾 File Management**: Organized storage for uploads and results
- **🔄 Status Polling**: Check job status until completion

### 🛠️ Technical Features
- **🐳 Full Docker Support**: Containerized frontend and backend
- **🔌 RESTful API**: Clean, well-structured endpoints
- **📱 Cross-Platform**: iOS, Android, and Web support
- **🔧 Portable FFmpeg**: Automatic setup on Windows
- **⚠️ Error Handling**: Comprehensive error messages and validation

## 📁 Project Structure

```
shuttercut/
├── frontend/                 # React Native Expo mobile app
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── screens/         # App screens (EditorScreen)
│   │   └── constants/       # Theme and configuration
│   ├── assets/              # Images and icons
│   └── package.json
├── backend/                  # FastAPI Python server
│   ├── main.py              # API endpoints and routing
│   ├── rendering.py         # FFmpeg video processing
│   ├── ffmpeg_utils.py      # FFmpeg utilities
│   ├── debug_overlay.py     # Debugging tools
│   └── requirements.txt
├── uploads/                  # Uploaded video storage
├── results/                  # Rendered video output
├── docker-compose.yml        # Docker orchestration
└── logo.svg                  # Project logo
```

## 🚀 Setup Instructions

### Prerequisites
- Node.js & npm
- Python 3.8+
- Expo Go app on your mobile device (or Android Studio / Xcode Simulator)

### 🔧 1. Backend Setup
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

### 📱 2. Frontend Setup
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

## 📱 Usage
1. Open the App.
2. Tap "Tap to Select Video".
3. Use "+ Text", "+ Image", or "+ Video" to add overlays.
4. Drag overlays to position them on the video.
5. Tap on an overlay to select it and adjust timing (start/end).
6. Tap "Export" to send for processing.
7. Watch the real-time progress percentage.
8. Download the result when rendering is complete.

## 🐳 Docker Setup (Alternative)

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

## 🔌 API Endpoints

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

## 🛠️ Technical Details

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





## 🏆 Highlights

- **Professional Design**: Beautiful dark theme UI with custom logo
- **Robust Backend**: Async processing with comprehensive error handling
- **Docker Ready**: One command to start the entire stack
- **Production Quality**: Clean code, proper project structure, extensive documentation
- **Extra Mile**: Logo design, splash screen, detailed API documentation





<div align="center">
  <p>Built with ❤️ for Buttercut.ai</p>
  <p>
    <a href="#-overview">Back to top ↑</a>
  </p>
</div>
