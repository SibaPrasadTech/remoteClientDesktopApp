// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { IpcRenderer,contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld('electronAPI', {
    setMousePosition: (position) => ipcRenderer.send('SET_MOUSE_POSITION',position),
    setSize: (size) => ipcRenderer.send('SET_SIZE', size),
    getScreenId : (callback) => ipcRenderer.on('SET_SCREEN_ID',callback)
})