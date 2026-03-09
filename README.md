<p align="center">
  <img src="https://github.com/CrawLeyYou/kick-vod-downloader/blob/main/public/logo.png?raw=true", width="256" height="256" />
</p>
<h1 align="center"> Kick VOD Downloader </h1>

> **Note:** This project is a customized, enhanced fork based on the original [Kick VOD Downloader](https://github.com/juddydev/kick-vod-downloader) by juddydev.

Kick VOD Downloader is a robust, desktop-based archiving application that allows you to quickly download streaming Video on Demand (VOD) archives directly from Kick.com. 

## ✨ Key Features & Enhancements

Building upon the original foundation, this customized version introduces several deep quality-of-life enhancements and raw performance improvements:

- **Parallel Segment Downloading**: Drastically speeds up VOD downloads by fetching multiple chunks simultaneously.
- **Integrated FFmpeg**: You no longer need to install FFmpeg manually; it is beautifully integrated directly into the compiled executable.
- **Smart Target Naming**: Files automatically save to a highly organized format: `[streamerName]_[date]_[duration]` (e.g., `flygun_2026-03-09_02-30-15.mp4`).
- **Precision Trimming**: Allows you to download only specific parts of a VOD by visually selecting `Start` and `End` times using an integrated slider.
- **Audio-Only Mode**: Transcodes video into MP3 format if you only require the audio (perfect for podcasts or interviews).
- **Auto-Language Detection**: The UI inherently detects your operating system language and adapts to it (currently supports English and Czech/Slovak out of the box).
- **Quality Options**: Allows you to pick your desired streaming quality directly pulled from Kick's adaptive bitrate manifest (720p60, 1080p60, etc.).
- **Live WebSocket Progress**: See exactly how many segments are downloaded, the estimated remaining time, and the remuxing progress in real-time.

---

## 🛠️ Tech Stack architecture

Behind the clean User Interface lies a powerful modern stack:
- **Frontend**: Next.js (React), styled with Tailwind CSS, utilizing Framer Motion for animations and Radix UI for highly accessible components.
- **Backend API**: An embedded Express server operating inside Node.js that orchestrates M3U8 parsing (`m3u8-parser`) and HTTP fetch jobs (`axios`).
- **Realtime**: Socket.io facilitates real-time data flow from the heavy IO background tasks right to the UI.
- **Container**: Electron securely packages the Next.js frontend and Express backend into easy-to-distribute, native cross-platform executables.

---

## 🚀 Usage & Installation

You no longer need to download or install FFmpeg separately. It is fully integrated into the application for all platforms. Just download the installer and you are ready to archive!

### Windows
Download the [latest build](https://github.com/Hammanek/kick-vod-downloader/releases/latest) `.exe` and run it.

### Linux
Download the [latest build](https://github.com/Hammanek/kick-vod-downloader/releases/latest).
 
**Snap**
Since these packages are unsigned, you need to pass the `--dangerous` argument to install via snap:
`sudo snap install --dangerous --classic "latest-build.snap"`

**AppImage**
AppImage requires FUSE to operate. Check out [this wiki](https://github.com/AppImage/AppImageKit/wiki/FUSE) on how to install FUSE for your distribution.

**tar.gz**
Simply extract the archive and start the `kick-vod-downloader` file.

### MacOS
Download the [latest build](https://github.com/Hammanek/kick-vod-downloader/releases/latest) `.dmg`.

To install and use the program in MacOS you need to remove the Apple Quarantine attribute from the unsigned file. Run this in your terminal:
`xattr -r -d com.apple.quarantine Kick.VOD.Downloader-*.dmg`

## 📝 License

This project is licensed under the [MIT](https://opensource.org/licenses/MIT) license.
