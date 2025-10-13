const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
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

  if (process.env.ELECTRON_OPEN_DEVTOOLS === 'true') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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
