import { app, BrowserWindow, Menu, ipcMain, dialog, session } from 'electron';
import path from 'path';
import express from 'express';
import { createServer } from './server';
import { getDatabase, closeDatabase } from './database';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let server: any = null;
let serverReady = false;

// Create Express server
const expressApp = createServer(isDev);
const PORT = process.env.PORT || 5000;

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: isDev ? undefined : path.join(__dirname, '../assets/icon.ico')
  });

  const startUrl = isDev ? 'http://localhost:5173' : `http://localhost:${PORT}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start Express server
function startServer() {
  return new Promise((resolve) => {
    server = expressApp.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      serverReady = true;
      resolve(true);
    });
  });
}

// App event listeners
app.on('ready', async () => {
  if (!isDev) {
    await session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage']
    });
  }

  // Initialize database
  getDatabase();

  // Start server
  await startServer();

  // Create window
  createWindow();

  // Create menu
  createMenu();

  // Handle IPC events
  setupIPC();
});

app.on('window-all-closed', () => {
  // On macOS, apps stay active until user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  // Close database
  closeDatabase();

  // Close server
  if (server) {
    server.close();
  }
});

// Create application menu
function createMenu() {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
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
        { role: 'paste' }
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
        { role: 'zoomOut' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About NonePOS',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About NonePOS',
              message: 'NonePOS - Professional Point of Sale System',
              detail: 'Version 1.0.0\n\nA comprehensive point of sale solution for businesses.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Setup IPC handlers
function setupIPC() {
  // Window controls
  ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
  });

  // File dialogs
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });
    return result;
  });

  // Print dialog
  ipcMain.handle('print', async (event, options) => {
    if (mainWindow) {
      mainWindow.webContents.print(options);
    }
  });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Error', 'An unexpected error occurred');
});
