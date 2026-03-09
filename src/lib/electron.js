const {
    app,
    BrowserWindow,
    dialog,
    Notification,
    shell,
    nativeTheme
} = require('electron')

nativeTheme.themeSource = 'dark'

const {
    exec
} = require("node:child_process")

let win
let devmode = (process.argv[2] === "dev") ? true : false
let currentPlatform;

if (process.platform === "win32") {
    app.setAppUserModelId("Kick VOD Downloader");
    currentPlatform = "win"
} else if (process.platform === "linux") {
    currentPlatform = "linux"
} else if (process.platform === "darwin") {
    currentPlatform = "darwin"
}

const createWindow = async () => {
    win = new BrowserWindow({
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    })

    win.maximize()
    win.loadURL('http://localhost:3000')

    if (devmode) {
        win.webContents.openDevTools()
    }

    win.on('closed', () => {
        win = null
        app.quit()
    })
}

const createCriticalError = async (message, detail) => {
    dialog.showMessageBox({
        type: "error",
        buttons: ["Exit"],
        title: "Error",
        message: message,
        detail: detail,
        defaultId: 0
    }).then(() => {
        process.exit(0)
    })
}

const createFolderSelectDialog = async (defaultPath) => new Promise(async (resolve, reject) => {
    dialog.showSaveDialog({
        defaultPath: defaultPath,
        filters: [{
            name: 'MPEG-4 Part 14',
            extensions: ['mp4']
        }]
    }).then((data) => {
        resolve(data)
    })
})

const createFFMPEGPathDialog = async () => new Promise(async (resolve, reject) => {
    dialog.showOpenDialog({
        title: "Select FFMPEG Executable",
        properties: ['openFile'],
        filters: [{
            name: 'Executables',
        }]
    }).then((data) => {
        resolve(data)
    })
})

const createSuccessNotif = async (savePath, language) => {
    const filename = (currentPlatform === "win") ? savePath.split("\\").slice(-1)[0]
        : (currentPlatform === "linux") ? savePath.split("/").slice(-1)[0] + ".mp4"
        : savePath.split("/").slice(-1)[0]
    const isCz = language === "cz"
    const notif = new Notification({
        title: isCz ? "Stahování dokončeno" : "Finished Downloading",
        body: isCz ? `Klikněte pro zobrazení ${filename}` : `Click to see ${filename}`
    })
    notif.on("click", () => {
        if (currentPlatform === "win") exec(`explorer /select,"${savePath}"`)
        else if (currentPlatform === "linux") exec(`xdg-open "${savePath.split("/").slice(0, -1).join("/")}"`)
        else if (currentPlatform === "darwin") exec(`open -R "${savePath}"`)
    })
    notif.show()
}

module.exports = {
    app,
    createWindow,
    createCriticalError,
    createFolderSelectDialog,
    createFFMPEGPathDialog,
    createSuccessNotif,
    currentPlatform
}