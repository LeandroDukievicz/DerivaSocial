// Ponte segura (contextBridge) entre o renderer e o main process.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getPosts: () => ipcRenderer.invoke("posts"),
  getStats: () => ipcRenderer.invoke("stats"),
  refresh: () => ipcRenderer.invoke("refresh"),
  markRead: (guid: string) => ipcRenderer.invoke("post:read", guid),
  markUnread: (guid: string) => ipcRenderer.invoke("post:unread", guid),
  suggestThumbnailTexts: (guid: string) => ipcRenderer.invoke("thumbnail:suggestions", guid),
  generateThumbnail: (payload: { guid: string; text: string; format: string }) => ipcRenderer.invoke("thumbnail:generate", payload),
  showThumbnail: (filePath: string) => ipcRenderer.invoke("thumbnail:show", filePath),
  useThumbnail: (payload: { guid: string; path: string }) => ipcRenderer.invoke("thumbnail:use", payload),
  revertImage: (guid: string) => ipcRenderer.invoke("thumbnail:revert", guid),
  linkedinStatus: () => ipcRenderer.invoke("linkedin:status"),
  instagramStatus: () => ipcRenderer.invoke("instagram:status"),
  threadsStatus: () => ipcRenderer.invoke("threads:status"),
  linkedinConnect: () => ipcRenderer.invoke("linkedin:connect"),
  publish: (payload: { guid: string; network: string; text: string }) => ipcRenderer.invoke("publish", payload),
  openPostWindow: (guid: string) => ipcRenderer.invoke("post:open-window", guid),
  openExternal: (url: string) => ipcRenderer.invoke("open:external", url),
  schedulePost: (payload: { guid: string; at: string; text: string; networks: string[] }) =>
    ipcRenderer.invoke("schedule:set", payload),
  cancelSchedule: (guid: string) => ipcRenderer.invoke("schedule:cancel", guid),
  onPostsUpdated: (cb: () => void) => {
    ipcRenderer.on("posts-updated", () => cb());
  },
});
