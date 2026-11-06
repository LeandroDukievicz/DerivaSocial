const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

test('voltar fecha apenas a janela de detalhes que iniciou a ação', () => {
  const handlers = new Map();
  const windows = [];
  class FakeWindow {
    constructor() { this.webContents = {}; this.closed = false; this.events = {}; windows.push(this); }
    setMenuBarVisibility() {}
    loadFile() {}
    on(name, handler) { this.events[name] = handler; }
    isDestroyed() { return this.closed; }
    close() { this.closed = true; this.events.closed?.(); }
    focus() {}
    static fromWebContents(sender) { return windows.find((window) => window.webContents === sender) || null; }
  }
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === 'electron') return {
      app: { setName() {}, getAppPath: () => '/app', whenReady: () => new Promise(() => {}), on() {} },
      BrowserWindow: FakeWindow,
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
      clipboard: {}, shell: {},
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  try { require('../dist/main.js'); } finally { Module._load = originalLoad; }

  handlers.get('post:open-window')({}, 'post-1');
  handlers.get('post:open-window')({}, 'post-2');
  const [first, second] = windows;
  handlers.get('post:close-window')({ sender: first.webContents });
  assert.equal(first.closed, true);
  assert.equal(second.closed, false);
  const unrelated = new FakeWindow();
  handlers.get('post:close-window')({ sender: unrelated.webContents });
  assert.equal(unrelated.closed, false);
});
