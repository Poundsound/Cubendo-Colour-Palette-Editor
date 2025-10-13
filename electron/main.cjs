const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const isDev = !!process.env.ELECTRON_START_URL || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: true,
  });

  const startUrl = process.env.ELECTRON_START_URL
    ? process.env.ELECTRON_START_URL
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;

  win.loadURL(startUrl);

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Forward console and load errors for easier diagnosis
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelMap = { 0: 'log', 1: 'warn', 2: 'error', 3: 'debug' };
    const lvl = levelMap[level] || 'log';
    console[lvl](`[renderer:${lvl}] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('Renderer failed to load:', code, desc, url);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
