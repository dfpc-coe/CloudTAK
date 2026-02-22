const { app, BrowserWindow, ipcMain, dialog, Menu, session, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');

// Allow GPU acceleration (needed for WebGL); sandbox remains disabled for current packaging
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('no-sandbox');

const configPath = path.join(app.getPath('userData'), 'config.json');
const preloadPath = path.join(__dirname, 'preload.js');
const setupIndexPath = path.join(__dirname, 'dist-setup', 'index.html');
const iconPath = path.join(__dirname, 'setup-ui', 'src', 'assets', 'CloudTAKLogo.svg');

let mainWindow;
let setupWindow;
let currentServerUrl = '';
let powerSaveBlockerId = null;

function startPowerSaveBlocker() {
    if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) return;
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
}

function stopPowerSaveBlocker() {
    if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlocker.stop(powerSaveBlockerId);
    }
    powerSaveBlockerId = null;
}

async function clearWebContext(targetSession) {
    try {
        await Promise.all([
            targetSession.clearCache(),
            targetSession.clearStorageData({
                storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers']
            })
        ]);
    } catch (err) {
        console.error('Failed to clear web context:', err);
    }
}

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
        icon: iconPath
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

ipcMain.on('save-url', (_event, url) => {
    void handleSaveUrl(url);
});

async function handleSaveUrl(url) {
    const targetUrl = (url || '').trim();
    if (!targetUrl) return;

    const isChange = currentServerUrl && targetUrl !== currentServerUrl;
    const targetSession = mainWindow ? mainWindow.webContents.session : session.defaultSession;

    if (isChange) {
        await clearWebContext(targetSession);
    }

    saveConfig({ serverUrl: targetUrl });
    currentServerUrl = targetUrl;

    if (mainWindow) {
        mainWindow.loadURL(targetUrl).catch((err) => {
            dialog.showErrorBox('Error loading URL', `Failed to load ${targetUrl}: ${err.message}`);
            createSetupWindow();
        });
    } else {
        createMainWindow(targetUrl);
    }

    if (setupWindow) {
        setupWindow.close();
    }
}

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
        icon: iconPath
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

    startPowerSaveBlocker();

    mainWindow.on('closed', function () {
        stopPowerSaveBlocker();
        mainWindow = null;
    });
}

app.on('ready', () => {
    const config = loadConfig();
    currentServerUrl = config.serverUrl || '';
    if (config.serverUrl) {
        createMainWindow(config.serverUrl);
    } else {
        createSetupWindow();
    }
});

app.on('window-all-closed', function () {
    stopPowerSaveBlocker();
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
