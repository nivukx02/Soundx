@echo off
echo Opening NIV Audio Codec Web App in Chrome...
echo.

REM Try common Chrome installation paths
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%~dp0index.html"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" "%~dp0index.html"
) else (
    REM If Chrome not found, open with default browser
    echo Chrome not found in default location. Opening with default browser...
    start "" "%~dp0index.html"
)

echo.
echo If the browser didn't open, manually open index.html in Chrome.
pause
