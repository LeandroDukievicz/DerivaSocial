// Ponte segura (contextBridge) entre o renderer e o main process.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getPosts: () => ipcRenderer.invoke("posts"),
  getStats: () => ipcRenderer.invoke("stats"),
  refresh: () => ipcRenderer.invoke("refresh"),
});
