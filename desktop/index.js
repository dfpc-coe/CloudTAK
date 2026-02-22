const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable hardware acceleration and sandbox for Linux compatibility
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');

const configPath = path.join(app.getPath('userData'), 'config.json');

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
        width: 500,
        height: 300,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        title: 'CloudTAK Setup',
        autoHideMenuBar: true,
    });

    setupWindow.loadFile('setup.html');

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
