// Preload: expose limited APIs if needed later
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('env', {
  isElectron: true,
});
