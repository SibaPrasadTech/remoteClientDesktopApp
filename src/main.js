const { app, BrowserWindow, desktopCapturer, ipcMain, Menu, screen } = require('electron');
const {mouse, straightTo, centerOf, Region, imageResource, sleep, Point} = require("@nut-tree/nut-js");
const path = require('path');
app.commandLine.appendSwitch('ignore-certificate-errors')
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}
let mainWindow;
let availableScreens;
let displays;

const sendSelectedScreen = (screen) => {
  console.log(`SCREEN ID : ${screen.id} selected`)
  const displaySize = displays.filter(display => `${display.id}` === screen.display_id)[0].size
  mainWindow.webContents.send('SET_SCREEN_ID',{
    id: screen.id,
    width: displaySize.width,
    height: displaySize.height
  })
}

const createSystemMenu = () => {
  const screenMenu = availableScreens.map((screen) => {
    return {
      "label" : screen.name,
      "click" : () => {
        sendSelectedScreen(screen)
      }
    }
  })

  const menu = Menu.buildFromTemplate([
    {
      label : app.name,
      submenu : [
        {role : 'quit'}
      ]
    },
    {
      label: 'Screens',
      submenu: screenMenu
    }
  ])

  Menu.setApplicationMenu(menu)
}



const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  ipcMain.on('SET_SIZE', (event,size) => {
    const {width,height} = size;
    try{
      mainWindow.setSize(width,height,true)
    }
    catch(err){
      console.log(err)
    }
  })
  ipcMain.on('SET_MOUSE_POSITION',async (event,position) => {
    console.log("POSITION : ",position)
    const {clientX,clientY,ratioX,ratioY} = position;
    await mouse.move(straightTo(new Point(clientX * ratioX,clientY * ratioY)));
  })
  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.setPosition(0,0)
    displays = screen.getAllDisplays();
    desktopCapturer.getSources({
      types: ['screen']
    }).then((sources) => {
      availableScreens = sources;
      createSystemMenu(sources);
      sendSelectedScreen(sources[0]);
    })
  })
  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
