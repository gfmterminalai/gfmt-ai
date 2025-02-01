#!/bin/bash

# Create fonts directory if it doesn't exist
mkdir -p public/fonts

# Download JetBrains Mono fonts
curl -L https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip -o jetbrains.zip
unzip jetbrains.zip -d temp
mv temp/fonts/webfonts/*.woff2 public/fonts/
rm -rf temp jetbrains.zip

# Download Fira Code fonts
curl -L https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip -o fira.zip
unzip fira.zip -d temp
mv temp/woff2/*.woff2 public/fonts/
rm -rf temp fira.zip

echo "Fonts downloaded successfully!" 