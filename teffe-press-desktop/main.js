const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Teffe Press',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#F4F6FB',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  win.once('ready-to-show', () => win.show());

  win.loadFile(path.join(__dirname, 'teffe-press-admin.html'));

  // abre links externos no browser padrão
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
