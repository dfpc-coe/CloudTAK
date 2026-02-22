const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Allow GPU acceleration (needed for WebGL); sandbox remains disabled for current packaging
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('no-sandbox');

const configPath = path.join(app.getPath('userData'), 'config.json');
const preloadPath = path.join(__dirname, 'preload.js');
const setupIndexPath = path.join(__dirname, 'dist-setup', 'index.html');

let mainWindow;
let setupWindow;

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (err) {
        console.error('Failed to load config:', err);
    }
    return { serverUrl: '' };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('Failed to save config:', err);
    }
}

function createSetupWindow() {
    if (setupWindow) {
        setupWindow.focus();
        return;
    }

    setupWindow = new BrowserWindow({
        width: 520,
        height: 640,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
        },
        title: 'CloudTAK Setup',
        autoHideMenuBar: true,
    });

    if (fs.existsSync(setupIndexPath)) {
        setupWindow.loadFile(setupIndexPath);
    } else {
        dialog.showErrorBox('Setup UI not built', 'Run "npm run build" inside desktop/setup-ui to generate dist-setup before launching the desktop app.');
        setupWindow.close();
        setupWindow = null;
        return;
    }

    setupWindow.on('closed', () => {
        setupWindow = null;
    });
}

ipcMain.on('save-url', (event, url) => {
    saveConfig({ serverUrl: url });
    if (mainWindow) {
        mainWindow.loadURL(url).catch((err) => {
            dialog.showErrorBox('Error loading URL', `Failed to load ${url}: ${err.message}`);
            createSetupWindow();
        });
    } else {
        createMainWindow(url);
    }
    if (setupWindow) {
        setupWindow.close();
    }
});

function createMainWindow(url) {
    if (mainWindow) {
        mainWindow.focus();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
            preload: preloadPath,
        },
        title: 'CloudTAK',
    });

    // Automatically grant permissions for geolocation and notifications
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['geolocation', 'notifications', 'media'];
        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            callback(false);
        }
    });

    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Change Server URL',
                    click: () => {
                        createSetupWindow();
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow.loadURL(url).catch((err) => {
        dialog.showErrorBox('Error loading URL', `Failed to load ${url}: ${err.message}`);
        mainWindow.close();
        createSetupWindow();
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', () => {
    const config = loadConfig();
    if (config.serverUrl) {
        createMainWindow(config.serverUrl);
    } else {
        createSetupWindow();
    }
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null && setupWindow === null) {
        const config = loadConfig();
        if (config.serverUrl) {
            createMainWindow(config.serverUrl);
        } else {
            createSetupWindow();
        }
    }
});
