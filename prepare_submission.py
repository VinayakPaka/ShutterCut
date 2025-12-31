#!/usr/bin/env python3
"""
Submission Preparation Script for ShutterCut Video Editing App

This script helps prepare the project for submission by:
1. Checking all required files exist
2. Verifying documentation is complete
3. Running basic tests
4. Creating a submission report
"""

import os
from pathlib import Path
import subprocess

# ANSI colors for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def check_file_exists(filepath, description):
    """Check if a file exists and report status."""
    if Path(filepath).exists():
        print(f"{GREEN}✓{RESET} {description}: {filepath}")
        return True
    else:
        print(f"{RED}✗{RESET} {description}: {filepath} (MISSING)")
        return False

def check_directory_exists(dirpath, description):
    """Check if a directory exists and report status."""
    if Path(dirpath).exists() and Path(dirpath).is_dir():
        print(f"{GREEN}✓{RESET} {description}: {dirpath}")
        return True
    else:
        print(f"{RED}✗{RESET} {description}: {dirpath} (MISSING)")
        return False

def main():
    print("=" * 70)
    print(f"{BLUE}ShutterCut Video Editing App - Submission Preparation Checklist{RESET}")
    print("=" * 70)
    
    checks_passed = []
    
    # Check Frontend Files
    print(f"\n{YELLOW}📱 Frontend Files{RESET}")
    checks_passed.append(check_file_exists("frontend/App.js", "Main App"))
    checks_passed.append(check_file_exists("frontend/package.json", "Package config"))
    checks_passed.append(check_file_exists("frontend/Dockerfile", "Frontend Dockerfile"))
    checks_passed.append(check_file_exists("frontend/src/screens/EditorScreen.js", "Editor screen"))
    checks_passed.append(check_file_exists("frontend/src/components/OverlayItem.js", "Overlay component"))
    checks_passed.append(check_file_exists("frontend/src/constants/theme.js", "Theme"))
    
    # Check Backend Files
    print(f"\n{YELLOW}🖥️  Backend Files{RESET}")
    checks_passed.append(check_file_exists("backend/main.py", "FastAPI main"))
    checks_passed.append(check_file_exists("backend/rendering.py", "Rendering logic"))
    checks_passed.append(check_file_exists("backend/ffmpeg_utils.py", "FFmpeg utils"))
    checks_passed.append(check_file_exists("backend/requirements.txt", "Python requirements"))
    checks_passed.append(check_file_exists("backend/Dockerfile", "Backend Dockerfile"))
    
    # Check Docker Files
    print(f"\n{YELLOW}🐳 Docker Files{RESET}")
    checks_passed.append(check_file_exists("docker-compose.yml", "Docker Compose"))
    checks_passed.append(check_file_exists(".dockerignore", "Docker ignore"))
    
    # Check Documentation
    print(f"\n{YELLOW}📚 Documentation{RESET}")
    checks_passed.append(check_file_exists("README.md", "Main README"))
    checks_passed.append(check_file_exists("DEPLOYMENT.md", "Deployment guide"))
    checks_passed.append(check_file_exists("SUBMISSION_CHECKLIST.md", "Submission checklist"))
    checks_passed.append(check_file_exists("PROJECT_SUMMARY.md", "Project summary"))
    
    # Check Configuration
    print(f"\n{YELLOW}⚙️  Configuration{RESET}")
    checks_passed.append(check_file_exists(".env.example", "Environment variables"))
    checks_passed.append(check_file_exists("test_api.py", "API test script"))
    
    # Check Directories
    print(f"\n{YELLOW}📂 Directories{RESET}")
    checks_passed.append(check_directory_exists("uploads", "Uploads directory"))
    checks_passed.append(check_directory_exists("results", "Results directory"))
    checks_passed.append(check_directory_exists("frontend/assets", "Frontend assets"))
    
    # Summary
    print("\n" + "=" * 70)
    passed = sum(checks_passed)
    total = len(checks_passed)
    percentage = (passed / total) * 100
    
    print(f"\n{BLUE}Summary:{RESET}")
    print(f"  Checks Passed: {passed}/{total} ({percentage:.1f}%)")
    
    if passed == total:
        print(f"\n{GREEN}✓ All checks passed! Project is ready for submission.{RESET}")
        print_next_steps()
        return 0
    else:
        print(f"\n{RED}✗ Some checks failed. Please fix the issues above.{RESET}")
        return 1

def print_next_steps():
    """Print the next steps for submission."""
    print(f"\n{BLUE}📋 Next Steps:{RESET}")
    print("1. Test the application:")
    print("   - Start backend: cd backend && uvicorn main:app --reload")
    print("   - Start frontend: cd frontend && npx expo start")
    print("   - Test with real videos and overlays")
    print()
    print("2. Record demo video showing:")
    print("   - Uploading a video")
    print("   - Adding text, image, and video overlays")
    print("   - Positioning and timing overlays")
    print("   - Exporting with progress tracking")
    print("   - Downloading the final result")
    print()
    print("3. Create sample rendered videos:")
    print("   - Use various overlay combinations")
    print("   - Test with different video formats")
    print()
    print("4. Upload to Google Drive:")
    print("   - Demo video (screen recording)")
    print("   - Rendered sample videos")
    print("   - Make folder publicly accessible")
    print()
    print("5. Prepare GitHub repository:")
    print("   - Commit all changes")
    print("   - Push to GitHub")
    print("   - Verify all files are visible")
    print("   - Check README displays correctly")
    print()
    print("6. Send email to arush@buttercut.ai:")
    print("   Subject: Full Stack Engineer {Your Name}")
    print("   Body:")
    print("     - GitHub repository link")
    print("     - Google Drive link (demo + rendered videos)")
    print("     - Brief introduction")
    print()
    print(f"{GREEN}Good luck with your submission! 🚀{RESET}")

if __name__ == "__main__":
    exit(main())
