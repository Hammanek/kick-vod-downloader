import express from "express"
import next from "next"
import path from "node:path"
import electron from "./lib/electron.js"
import child_process from "node:child_process"
import m3u8 from "m3u8-parser"
import ax from "axios"
import {
    EventEmitter
} from "node:events"
import { createServer } from "node:http"
import { Server } from "socket.io"
import fs from "node:fs"
import packageDetails from "../package.json" with {type: "json"}

const devMode = (process.argv[2] === "dev") ? true : false
const nextApp = next({
    dev: devMode,
    dir: electron.app.getAppPath()
})
const getHandler = nextApp.getRequestHandler()
const __dirname = import.meta.dirname
const ffmpegEvents = new EventEmitter()
const app = express()
const httpServer = createServer(app)

process.on('uncaughtException', (err) => {
    electron.createCriticalError("Uncaught Exception", err.stack || err.message)
})
process.on('unhandledRejection', (reason) => {
    electron.createCriticalError("Unhandled Rejection", reason?.stack || reason?.message || String(reason))
})

const io = new Server(httpServer)
const axios = ax.create({
    headers: { "User-Agent": `${packageDetails.name}/${packageDetails.version}` }
})

let ffmpegPath
let activeProcesses = []
let canceled = []

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.disable('x-powered-by');
app.use(express.static(__dirname + '/public'))

ffmpegEvents.on("increase", (data) => {
    let betterData = {
        uuid: data.uuid,
        progress: ((data.progress / data.total) * 100).toFixed(2),
        segment: `${data.progress} / ${data.total}`,
        remainingData: (data.total - data.progress)
    }
    io.emit("increase", JSON.stringify(betterData))
})

ffmpegEvents.on("details", (data) => {
    let betterData = {
        uuid: data.uuid,
        downloadedFrames: data.details.split("frame=")[1].split("fps")[0].replaceAll(" ", ""),
        bitrate: data.details.split("bitrate=")[1].split("speed")[0].replaceAll(" ", ""),
        fileSize: data.details.split("size=")[1].split("time")[0].replaceAll(" ", ""),
        downloadedTotalTime: data.details.split("time=")[1].split("bitrate")[0].replaceAll(" ", "")
    }
    io.emit("details", JSON.stringify(betterData))
})

const checkFFmpeg = async (path) => new Promise((resolve, reject) => {
    child_process.execFile(path, ["-version"], (err, stdout, stderr) => {
        (stdout.split("\n")[0] === "") ? resolve({ status: false, code: err.code }) : resolve({ status: true, response: stdout.split("\n")[0] })
    })
})

if (electron.currentPlatform === "win") {
    // 1. Check packaged resources path (for compiled .exe)
    let packagedFFmpeg = path.join(process.resourcesPath, "ffmpeg.exe")
    // 2. Check local dev root path
    let localFFmpeg = path.join(electron.app.getAppPath(), "ffmpeg.exe")

    if (fs.existsSync(packagedFFmpeg)) {
        ffmpegPath = packagedFFmpeg
    } else if (fs.existsSync(localFFmpeg)) {
        ffmpegPath = localFFmpeg
    } else {
        var ffmpegList = process.env.PATH.split(";").filter((data) => data.includes("ffmpeg"))
        if (ffmpegList.length == 1) {
            await checkFFmpeg(path.join(ffmpegList[0], "/ffmpeg.exe")).then((data) => {
                if (data.status) {
                    ffmpegPath = path.join(ffmpegList[0], "/ffmpeg.exe")
                }
            })
        } else if (ffmpegList.length > 1) {
            for (var i = 0; ffmpegList.length > i; i++) {
                var data = await checkFFmpeg(path.join(ffmpegList[i], "/ffmpeg.exe"))
                if (data.status) {
                    ffmpegPath = path.join(ffmpegList[i], "/ffmpeg.exe")
                    break
                }
            }
        }
    }
} else if (electron.currentPlatform === "linux") {
    let localFFmpeg = path.join(electron.app.getAppPath(), "ffmpeg")
    if (fs.existsSync(localFFmpeg)) {
        ffmpegPath = localFFmpeg
    } else {
        await checkFFmpeg("/bin/ffmpeg").then((data) => {
            if (data.status) {
                ffmpegPath = "/bin/ffmpeg"
            }
        })
    }
} else if (electron.currentPlatform === "darwin") {
    let localFFmpeg = path.join(electron.app.getAppPath(), "ffmpeg")
    if (fs.existsSync(localFFmpeg)) {
        ffmpegPath = localFFmpeg
    } else {
        await checkFFmpeg("/Applications/ffmpeg").then((data) => {
            if (data.status) {
                ffmpegPath = "/Applications/ffmpeg"
            }
        })
    }
}

// --- Parallel Segment Downloader ---
const PARALLEL_LIMIT = 15 // number of segments downloaded at the same time

const cleanupTempSegments = (segmentPaths, concatPath) => {
    for (const p of segmentPaths) {
        try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch (e) { /* ignore */ }
    }
    try { if (concatPath && fs.existsSync(concatPath)) fs.unlinkSync(concatPath) } catch (e) { /* ignore */ }
}

const downloadSegment = async (url, destPath, retries = 3) => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 })
            fs.writeFileSync(destPath, Buffer.from(response.data))
            return
        } catch (err) {
            if (attempt === retries - 1) throw err
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        }
    }
}

const parallelDownloadSegments = async (segmentURLs, uuid, cancelCheck, tempDir) => {
    const segmentPaths = segmentURLs.map((_, i) => path.join(tempDir, `${uuid}_seg${i}.ts`))
    let downloaded = 0
    const total = segmentURLs.length

    // Run downloads in batches of PARALLEL_LIMIT
    for (let i = 0; i < total; i += PARALLEL_LIMIT) {
        if (cancelCheck()) return { paths: segmentPaths, canceled: true } // aborted — return paths for cleanup
        const batch = segmentURLs.slice(i, i + PARALLEL_LIMIT)
        const batchPaths = segmentPaths.slice(i, i + PARALLEL_LIMIT)
        await Promise.all(batch.map((url, j) =>
            downloadSegment(url, batchPaths[j]).then(() => {
                downloaded++
                ffmpegEvents.emit("increase", {
                    uuid,
                    progress: downloaded,
                    total
                })
                // Emit live details during segment download phase
                // Use segmentPaths.slice(0, downloaded) to accumulate size across ALL downloaded segments so far
                const segFileSizeBytes = segmentPaths.slice(0, downloaded).reduce((acc, p) => {
                    try { return acc + (fs.existsSync(p) ? fs.statSync(p).size : 0) } catch { return acc }
                }, 0)
                const fileSizeMB = (segFileSizeBytes / (1024 * 1024)).toFixed(1)
                ffmpegEvents.emit("details", {
                    uuid,
                    details: `frame= 0 fps=0 size=${fileSizeMB}MB time=00:00:00.00 bitrate=N/A speed=N/A`
                })
            })
        ))
    }
    return { paths: segmentPaths, canceled: false }
}

const getSegmentURLs = (playlistText, baseURL) => {
    var parser = new m3u8.Parser()
    parser.push(playlistText)
    parser.end()
    return parser.manifest.segments.map(seg =>
        seg.uri.startsWith("http") ? seg.uri : baseURL + seg.uri
    )
}

const buildConcatList = (segmentPaths, concatPath) => {
    const lines = segmentPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n")
    fs.writeFileSync(concatPath, lines)
}

const ffmpegCloseHandler = async (proc, savePath, tempSegPaths, concatPath, uuid, language) => {
    proc.on("exit", () => {
        activeProcesses = activeProcesses.filter(data => data.proc.pid !== proc.pid)
        var result = (proc.spawnargs.filter((data) => {
            if (canceled.includes(data)) return true
        }))
        // Always clean up temp segments
        if (tempSegPaths) cleanupTempSegments(tempSegPaths, concatPath)
        // Remove _temp_segments folder if it is now empty
        if (concatPath) {
            try {
                const tempDir = path.dirname(concatPath)
                if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) {
                    fs.rmdirSync(tempDir)
                }
            } catch (e) { /* ignore */ }
        }
        if (result[0] === undefined) {
            // Notify frontend that remux is complete
            io.emit("remuxDone", JSON.stringify({ uuid }))
            electron.createSuccessNotif(savePath, language)
        } else {
            canceled = canceled.filter((data) => data !== result[0])
            if (fs.existsSync(savePath)) {
                fs.unlink(savePath, (err) => {
                    if (err) console.error(`Error deleting partial file: ${err.message}`)
                })
            }
        }
    })
}

const spawnFFmpegConcat = (concatPath, savePath, parameters, segmentPaths) => {
    const ffmpegOptions = [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatPath,
        ...(parameters.audioOnly
            ? ["-vn", "-c:a", "libmp3lame", "-q:a", "2"]
            : ["-c", "copy"]),
        savePath
    ]
    // Notify frontend that remuxing has started
    io.emit("remuxing", JSON.stringify({ uuid: parameters.uuid }))
    let process = child_process.execFile(ffmpegPath, ffmpegOptions)
    ffmpegCloseHandler(process, savePath, segmentPaths, concatPath, parameters.uuid, parameters.language)
    // Emit remux progress via stderr
    process.stderr.on("data", (data) => {
        const str = data.toString()
        if (str.match(/size=.*time=.*bitrate=/)) {
            ffmpegEvents.emit("details", {
                uuid: parameters.uuid,
                details: str
            })
        } else {
            console.log(str)
        }
    })
    activeProcesses.push({
        uuid: parameters.uuid,
        source: concatPath,
        proc: process,
        savePath: savePath
    })
    return process
}

// Main download orchestrator — resolves segment list, downloads in parallel, remuxes
const startParallelDownload = async (playlistURL, savePath, parameters) => {
    const baseURL = playlistURL.split("/").slice(0, -1).join("/") + "/"
    // Store temp segments next to the output video for easy manual cleanup if app crashes
    const tempDir = path.join(path.dirname(savePath), "_temp_segments")
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    const concatPath = path.join(tempDir, `${parameters.uuid}_concat.txt`)

    let playlistText
    await axios.get(playlistURL).then(res => { playlistText = res.data })

    let allSegURLs = getSegmentURLs(playlistText, baseURL)

    // For non-entireVOD: filter by time range
    if (!parameters.entireVOD) {
        var parser = new m3u8.Parser()
        parser.push(playlistText)
        parser.end()
        let startSec = 0, endSec = 0
        parameters.startTime.split(":").map((d, i) => { startSec += parseInt(d) * Math.pow(60, 2 - i) })
        parameters.endTime.split(":").map((d, i) => { endSec += parseInt(d) * Math.pow(60, 2 - i) })
        let cumulative = 0, inRange = false, filtered = []
        for (const seg of parser.manifest.segments) {
            const segEnd = cumulative + seg.duration
            if (segEnd > startSec && cumulative < endSec) {
                const url = seg.uri.startsWith("http") ? seg.uri : baseURL + seg.uri
                filtered.push(url)
                inRange = true
            } else if (inRange && cumulative >= endSec) break
            cumulative = segEnd
        }
        allSegURLs = filtered
    }

    parameters.segments = allSegURLs.length

    // Register a placeholder in activeProcesses so cancel works during download
    const cancelRef = { canceled: false, proc: null }
    activeProcesses.push({
        uuid: parameters.uuid,
        source: playlistURL,
        proc: { kill: () => { cancelRef.canceled = true }, pid: `dl-${parameters.uuid}`, spawnargs: [playlistURL] },
        savePath: savePath
    })

    const dlResult = await parallelDownloadSegments(allSegURLs, parameters.uuid, () => cancelRef.canceled, tempDir)

    // Remove the placeholder
    activeProcesses = activeProcesses.filter(d => d.uuid !== parameters.uuid || d.proc.pid !== `dl-${parameters.uuid}`)

    if (dlResult.canceled) {
        // Always clean up any partially downloaded segments
        cleanupTempSegments(dlResult.paths, concatPath)
        try { if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) fs.rmdirSync(tempDir) } catch (e) { /* ignore */ }
        if (fs.existsSync(savePath)) try { fs.unlinkSync(savePath) } catch (e) { /* ignore */ }
        canceled = canceled.filter(d => d !== playlistURL)
        return
    }

    buildConcatList(dlResult.paths, concatPath)
    spawnFFmpegConcat(concatPath, savePath, parameters, dlResult.paths)
}


nextApp.prepare().then(() => {
    httpServer.listen(3000, async () => {
        electron.app.whenReady().then(() => electron.createWindow()).catch((err) => {
            electron.createCriticalError("An error occurred while creating the window.", err.message)
        })
    })

    app.get("/", (req, res) => {
        return nextApp.render(req, res, "/")
    })

    io.on("connection", (socket) => {
    })

    app.post("/api/download", async (req, res) => {
        var parameters = req.body
        let source
        let savePath
        let cancel = false
        var parser = new m3u8.Parser()
        await axios.get(parameters.source).then(async (data) => {
            await parser.push(data.data)
            await parser.end()
            parser.manifest.playlists.forEach((ress) => {
                if (ress.attributes.VIDEO === parameters.resolution || (parameters.resolution === "audio" && source === undefined)) {
                    source = parameters.source.replace("master.m3u8", ress.uri)
                }
            })
        }).catch((err) => {
            res.json({
                error: err.message
            })
        })
        if (ffmpegPath === undefined && electron.currentPlatform === "win" || ffmpegPath === undefined && electron.currentPlatform === "darwin") {
            await electron.createFFMPEGPathDialog().then((data) => {
                if (!data.canceled) {
                    ffmpegPath = path.join(data.filePaths[0])
                } else {
                    cancel = true
                }
            })
        } else if (ffmpegPath === undefined && electron.currentPlatform === "linux") {
            electron.createCriticalError("FFmpeg not found", "FFmpeg is not installed / corrupted on your system. Please install FFmpeg and restart the application.")
            cancel = true
        }
        if (!cancel) {
            const sanitizedTitle = (parameters.title || "stream").replace(/[<>:"/\\|?*]/g, "_");
            const extension = parameters.audioOnly ? ".mp3" : ".mp4";
            await electron.createFolderSelectDialog(`${sanitizedTitle}${extension}`).then((data) => {
                if (!data.canceled) {
                    savePath = path.join(data.filePath)
                } else {
                    cancel = true
                }
            })
        }
        if (!cancel) {
            // Both entireVOD and clip downloads now use parallel segment downloader
            startParallelDownload(source, savePath, parameters)
        }
        res.json({
            cancel: cancel,
            source: source
        })
    })

    app.post("/api/cancel", (req, res) => {
        let killed = false
        activeProcesses.map(async (data) => {
            if (data.uuid === req.body?.uuid) {
                canceled.push(data.source)
                data.proc.kill()
                killed = true

                // Prompt file deletion if it exists
                if (fs.existsSync(data.savePath)) {
                    fs.unlink(data.savePath, (err) => {
                        if (err) console.error(`Error deleting file on cancel: ${err.message}`)
                    })
                }

                res.json({
                    status: "killed"
                })
            }
        })
        if (!killed) {
            res.json({
                status: "nochange",
                message: "there is no such a process"
            })
        }
    })

    app.post("/api/resolution", async (req, res) => {
        var parser = new m3u8.Parser()
        await axios.get(req.body?.source).then((data) => {
            parser.push(data.data)
            parser.end()
        }).catch((err) => {
            res.json({
                error: err.message
            })
        })
        res.json({
            source: req.body?.source,
            resolutions: Object.keys(parser.manifest.mediaGroups.VIDEO)
        })
    })

    app.get(/.*/, (req, res) => {
        return getHandler(req, res)
    })
}).catch(async (err) => {
    electron.createCriticalError("An error occurred while starting the NextApp.", err.message)
})