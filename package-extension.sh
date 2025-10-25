#!/bin/bash

echo "Packaging Upwork Auto Applier Extension..."

# Create package directory
mkdir -p package

# Copy extension files
cp manifest.json package/
cp background.js package/
cp content.js package/
cp popup.html package/
cp popup.js package/
cp README.md package/

# Create ZIP file
cd package
zip -r ../upwork-auto-applier-extension.zip .
cd ..

# Clean up
rm -rf package

echo ""
echo "✅ Extension packaged successfully!"
echo "📦 File: upwork-auto-applier-extension.zip"
echo ""
echo "Next steps:"
echo "1. Upload the ZIP file to your website"
echo "2. Update the download links in install-extension.html"
echo "3. Share the installation page with users"
echo ""
