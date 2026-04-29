import { contextBridge, ipcRenderer } from 'electron';

// Expose only what's needed
contextBridge.exposeInMainWorld('electron', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // File dialogs
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // Print
  print: (options: any) => ipcRenderer.invoke('print', options),

  // Platform info
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development'
});
