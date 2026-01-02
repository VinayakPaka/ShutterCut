@echo off
:: Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Requesting Admin Privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

echo.
echo ==========================================
echo   ALLOWING PORT 8000 (Powershell)
echo ==========================================
echo.
powershell -Command "Remove-NetFirewallRule -DisplayName 'ShutterCut_Backend_Port_8000' -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName 'ShutterCut_Backend_Port_8000' -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Any"
echo.
echo If you see a success message above, it worked.
echo.
pause
