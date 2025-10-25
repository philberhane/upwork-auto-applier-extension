@echo off
echo Packaging Upwork Auto Applier Extension...

REM Create package directory
if not exist "package" mkdir package

REM Copy extension files
copy manifest.json package\
copy background.js package\
copy content.js package\
copy popup.html package\
copy popup.js package\
copy README.md package\

REM Create ZIP file
powershell Compress-Archive -Path "package\*" -DestinationPath "upwork-auto-applier-extension.zip" -Force

REM Clean up
rmdir /s /q package

echo.
echo ✅ Extension packaged successfully!
echo 📦 File: upwork-auto-applier-extension.zip
echo.
echo Next steps:
echo 1. Upload the ZIP file to your website
echo 2. Update the download links in install-extension.html
echo 3. Share the installation page with users
echo.
pause
