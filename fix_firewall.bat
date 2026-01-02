@echo off
echo Requesting Admin privileges to open Port 8000 for the backend...
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command New-NetFirewallRule -DisplayName \"ShutterCut_Backend\" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow; Write-Host \"Firewall rule added! Press Enter to exit...\"; Read-Host'"
echo Done. Please try the upload again.
pause
