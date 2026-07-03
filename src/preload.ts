// Ponte segura (contextBridge) entre o renderer e o main process.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getPosts: () => ipcRenderer.invoke("posts"),
  getStats: () => ipcRenderer.invoke("stats"),
  refresh: () => ipcRenderer.invoke("refresh"),
  suggestThumbnailTexts: (guid: string) => ipcRenderer.invoke("thumbnail:suggestions", guid),
  generateThumbnail: (payload: { guid: string; text: string; format: string }) => ipcRenderer.invoke("thumbnail:generate", payload),
  showThumbnail: (filePath: string) => ipcRenderer.invoke("thumbnail:show", filePath),
  linkedinStatus: () => ipcRenderer.invoke("linkedin:status"),
  linkedinConnect: () => ipcRenderer.invoke("linkedin:connect"),
  publish: (payload: { guid: string; network: string; text: string }) => ipcRenderer.invoke("publish", payload),
});
