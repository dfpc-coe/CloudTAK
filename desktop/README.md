# CloudTAK Desktop

This is an Electron wrapper for CloudTAK that allows you to use it as a desktop application.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the app in development mode:
   ```bash
   npm start
   ```

3. Build the app for your platform:
   ```bash
   npm run build
   ```

## Usage

When you first launch the app, you will be prompted to enter the URL of your CloudTAK server (e.g., `https://cloudtak.example.com`). The app will save this URL and load it automatically on subsequent launches.

To change the URL later, you can delete the `config.json` file in the app's user data directory (e.g., `~/.config/CloudTAK/config.json` on Linux, `%APPDATA%\CloudTAK\config.json` on Windows, or `~/Library/Application Support/CloudTAK/config.json` on macOS).
