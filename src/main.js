const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const storage = require("electron-json-storage");

require("@electron/remote/main").initialize();

if (require("electron-squirrel-startup")) return app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    webPreferences: {
      enableRemoteModule: true,
      nodeIntegration: true,
      contextIsolation: false, // protect against prototype pollution
    },
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, "index2.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
