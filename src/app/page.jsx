'use client'

import React from "react"
import ax from "axios"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import socketIO from 'socket.io-client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"


const socket = socketIO.connect('ws://localhost:3000')

export default function Home() {
  const axios = ax.create({
    headers: { "User-Agent": "kick-vod-downloader/2.0.0" }
  })
  const kickAPI = "https://kick.com/api/v1/"
  const [inputData, setInputData] = React.useState("")
  const [vods, setVODs] = React.useState([])
  const [resOpenState, setResOpenState] = React.useState(false)
  const [resolutions, setResolutions] = React.useState([])
  const [selectedRes, setSelectedRes] = React.useState("")
  const [selectedVOD, setSelectedVOD] = React.useState("")
  const [selectedUUID, setSelectedUUID] = React.useState("")
  const [detailsOpenState, setDetailsOpenState] = React.useState(false)
  const selectedDetails = React.useRef("")
  const [remainingData, setRemainingData] = React.useState("")
  const [prevTime, setPrevTime] = React.useState(Date.now())
  const [remaining, setRemaining] = React.useState("")
  const [details, setDetails] = React.useState({})
  const [segments, setSegments] = React.useState("")
  const [entireVOD, setEntireVOD] = React.useState(true)
  const [VODEndTime, setVODEndTime] = React.useState("")
  const [language, setLanguage] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language')
      if (saved) return saved

      const browserLang = navigator.language || navigator.userLanguage || ''
      if (browserLang.toLowerCase().startsWith('cs') || browserLang.toLowerCase().startsWith('sk')) {
        return 'cz'
      }
    }
    return 'en'
  })
  const [audioOnly, setAudioOnly] = React.useState(false)
  const [range, setRange] = React.useState([0, 0])
  const [maxSeconds, setMaxSeconds] = React.useState(0)

  const translations = {
    cz: {
      title: "KICK VOD DOWNLOADER",
      subtitle: "Rychlý a spolehlivý nástroj pro archivaci streamů",
      streamSearch: "Vyhledávání",
      placeholder: "Zadejte uživatelské jméno nebo odkaz na VOD...",
      fetchVods: "Načíst",
      downloaded: "Staženo",
      download: "Stáhnout",
      cancel: "Zrušit",
      details: "Detaily",
      invalidInput: "Neplatný vstup",
      invalidInputDesc: "Zadejte prosím platné uživatelské jméno nebo odkaz na VOD.",
      invalidTime: "Neplatný čas/vzorec nebo chybí rozlišení",
      invalidTimeDesc: "Zadejte prosím platný čas a zvolte rozlišení (např. 00:00:00).",
      noResolution: "Chybí rozlišení",
      noResolutionDesc: "Prosím zvolte rozlišení.",
      downloading: "Stahuji VOD",
      withRes: "v rozlišení",
      downloadCancelled: "Stahování zrušeno",
      downloadCancelledDesc: "Stahování bylo zrušeno a dočasný soubor byl smazán.",
      settingsTitle: "Vyberte nastavení pro video",
      resolution: "Rozlišení",
      downloadEntireVod: "Stáhnout celé VOD",
      start: "Od",
      end: "Do",
      close: "Zavřít",
      fileSize: "Velikost souboru",
      segments: "Segmenty",
      remaining: "Zbývá",
      remuxing: "Slučuji segmenty...",
      noResults: "Nenalezeno",
      noResultsDesc: "Zadaný kanál nebo VOD nebyl nalezen, nebo nemá žádný obsah.",
      audioOnly: "Pouze zvuk (MP3)",
      trimming: "Výběr úseku"
    },
    en: {
      title: "KICK VOD DOWNLOADER",
      subtitle: "Fast & Reliable Stream Archive Tool",
      streamSearch: "Search",
      placeholder: "Enter username or VOD link...",
      fetchVods: "Load",
      downloaded: "Downloaded",
      download: "Download",
      cancel: "Cancel",
      details: "Details",
      invalidInput: "Invalid input",
      invalidInputDesc: "Please enter a valid username or VOD link.",
      invalidTime: "Invalid time/pattern & Resolution",
      invalidTimeDesc: "Please select a resolution and make sure enter a valid time/pattern. i.e: 00:00:00",
      noResolution: "No Resolution",
      noResolutionDesc: "Please select a resolution.",
      downloading: "Downloading VOD",
      withRes: "with resolution",
      downloadCancelled: "Download Cancelled",
      downloadCancelledDesc: "The download has been cancelled and temporary file removed.",
      settingsTitle: "Select settings you want for the video",
      resolution: "Resolution",
      downloadEntireVod: "Download Entire VOD",
      start: "Start",
      end: "End",
      close: "Close",
      fileSize: "File Size",
      segments: "Segments",
      remaining: "Remaining",
      remuxing: "Merging segments...",
      noResults: "Not Found",
      noResultsDesc: "The specified channel or VOD was not found, or has no content.",
      audioOnly: "Audio Only (MP3)",
      trimming: "Trim Video"
    }
  }

  const t = (key) => translations[language][key] || key

  React.useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])



  React.useEffect(() => {
    setRemaining(((((new Date(Date.now()) - new Date(prevTime)) / 1000) * remainingData) / 60).toFixed(1) + " minutes")
    setPrevTime(Date.now())
  }, [remainingData])

  React.useEffect(() => {
    const handleDetails = (data) => {
      var JSONData = JSON.parse(data)
      if (JSONData.uuid === selectedDetails.current) {
        setDetails(JSONData)
      }
    }

    const handleIncrease = (data) => {
      var JSONData = JSON.parse(data)
      const element = document.getElementById('progress-' + JSONData.uuid)
      const textElement = document.getElementById('progress-text-' + JSONData.uuid)

      if (element) {
        element.style.display = "block"
        element.firstElementChild.style.transform = `translateX(-${100 - (JSONData.progress || 0)}%)`
      }

      if (textElement) {
        textElement.style.display = "block"
        textElement.innerText = `${JSONData.progress}% (${JSONData.segment})`

        // Update document title if this is the active download
        if (JSONData.progress < 100) {
          document.title = `[${JSONData.progress}%] Kick VOD Downloader`
        } else {
          document.title = `Kick VOD Downloader`
        }
      }

      if (document.getElementById('button-' + JSONData.uuid)?.innerText === "Download") {
        cancelButton(JSONData.uuid)
      }

      // Don't show 'Downloaded' yet at 100% — wait for remuxDone event
      // (ffmpeg still needs to merge the segments)

      if (JSONData.uuid === selectedDetails.current) {
        setSegments(JSONData.segment)
        setRemainingData(JSONData.remainingData)
      }
    }

    const handleRemuxing = (data) => {
      var JSONData = JSON.parse(data)
      const element = document.getElementById('progress-' + JSONData.uuid)
      const textElement = document.getElementById('progress-text-' + JSONData.uuid)
      // Show indeterminate pulsing bar at 100% width
      if (element) {
        element.style.display = "block"
        element.firstElementChild.style.transform = `translateX(0%)`
      }
      if (textElement) {
        textElement.style.display = "block"
        textElement.innerText = t('remuxing')
      }
    }

    const handleRemuxDone = (data) => {
      var JSONData = JSON.parse(data)
      const element = document.getElementById('progress-' + JSONData.uuid)
      const textElement = document.getElementById('progress-text-' + JSONData.uuid)
      document.getElementById("downloaded-" + JSONData.uuid).style.display = "block"
      downloadButton(JSONData.uuid)
      if (textElement) textElement.style.display = "none"
      if (element) element.style.display = "none"
    }

    socket.on("details", handleDetails)
    socket.on("increase", handleIncrease)
    socket.on("remuxing", handleRemuxing)
    socket.on("remuxDone", handleRemuxDone)

    return () => {
      socket.off("details", handleDetails)
      socket.off("increase", handleIncrease)
      socket.off("remuxing", handleRemuxing)
      socket.off("remuxDone", handleRemuxDone)
    }
  }, [])

  React.useEffect(() => {
    vods.forEach((vod) => {
      const element = document.getElementById('progress-' + vod.video.uuid)
      if (element) {
        element.style.display = "none"
      }
      if (document.getElementById('button-' + vod.video.uuid)?.innerText === "Cancel") {
        downloadButton(vod.video.uuid)
      }
      if (document.getElementById("downloaded-" + vod.video.uuid).style.display = "block") {
        document.getElementById("downloaded-" + vod.video.uuid).style.display = "none"
      }

    })
  }, [vods])

  const downloadButton = (uuid) => {
    document.getElementById("button-" + uuid).setAttribute("data-state", "download")
    document.getElementById("button-" + uuid).innerText = t('download')
    document.getElementById("progress-" + uuid).style.display = "none"
    document.getElementById("details-button-" + uuid).style.display = "none"
  }

  const cancelButton = (uuid) => {
    document.getElementById('button-' + uuid).setAttribute("data-state", "cancel")
    document.getElementById('button-' + uuid).innerText = t('cancel')
    document.getElementById("details-button-" + uuid).style.display = "inline"
    if (document.getElementById("downloaded-" + uuid).style.display = "block") document.getElementById("downloaded-" + uuid).style.display = "none"
  }

  const fetchVODs = async () => {
    try {
      if (inputData.match(/^https:\/\/kick.com\/[a-zA-z0-9]{4,25}\/videos\/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/) !== null) {
        let res = await axios.get(`${kickAPI}video/${inputData.split("videos/")[1]}`)
        if (res.data && res.data.livestream) {
          setVODs([{ duration: res.data.livestream.duration, thumbnail: { src: (res.data.livestream.thumbnail !== null) ? res.data.livestream.thumbnail : "/thumbnail-err.png" }, session_title: res.data.livestream.session_title, start_time: res.data.livestream.start_time, video: { uuid: res.data.uuid } }])
        } else {
          setVODs([])
          toast(t('noResults'), {
            description: t('noResultsDesc'),
            action: { label: t('close') },
          })
        }
      }
      else if (inputData.match(/^[a-zA-Z0-9]{4,25}$/) !== null) {
        let res = await axios.get(`${kickAPI}channels/${inputData}`)
        if (res.data.previous_livestreams && res.data.previous_livestreams.length > 0) {
          setVODs(res.data.previous_livestreams)
        } else {
          setVODs([])
          toast(t('noResults'), {
            description: t('noResultsDesc'),
            action: { label: t('close') },
          })
        }
      }
      else {
        toast(t('invalidInput'), {
          description: t('invalidInputDesc'),
          action: {
            label: t('close')
          },
        })
      }
    } catch (e) {
      console.log(e)
      setVODs([])
      toast(t('noResults'), {
        description: t('noResultsDesc'),
        action: { label: t('close') },
      })
    }
  }

  const buttonEventSelection = async (event) => {
    const dataState = event.currentTarget.getAttribute("data-state")
    const dataUuid = event.currentTarget.getAttribute("data-uuid")

    if (dataState === "download") {
      fetchResolution(dataUuid)
      const endTime = document.getElementById("timestamp-" + dataUuid).innerText
      setVODEndTime(endTime)

      // Calculate max seconds for slider
      let totalSec = 0
      endTime.split(":").map((d, i) => { totalSec += parseInt(d) * Math.pow(60, 2 - i) })
      setMaxSeconds(totalSec)
      setRange([0, totalSec])
    }
    else if (dataState === "cancel") {
      cancelDownload({ uuid: dataUuid })
    }
  }

  const fetchResolution = async (dataUuid) => {
    fetchVODProperties(dataUuid).then((res) => {
      axios.post("/api/resolution", {
        source: res.source
      }, []).then((fetch) => {
        setSelectedUUID(dataUuid)
        setResolutions(fetch.data.resolutions)
        setSelectedVOD(res.source)
        setResOpenState(true)
      })
    })
  }

  const timeToSeconds = (time) => {
    let seconds = 0
    time.split(":").map((data, index) => {
      seconds += parseInt(data) * Math.pow(60, (2 - index))
    })
    return seconds
  }

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // fallback if invalid date
    
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  const secondsToTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
    const seconds = (totalSeconds % 60).toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  const isEndGreater = async (startTime, endTime) => {
    const startTimeAsSeconds = timeToSeconds(startTime)
    const endTimeAsSeconds = timeToSeconds(endTime)

    if (startTimeAsSeconds > endTimeAsSeconds) {
      return false
    }
    else {
      return true
    }
  }

  const downloadVOD = async () => {
    const startVal = entireVOD ? "00:00:00" : document.getElementById("startTime").value
    const endVal = entireVOD ? VODEndTime : document.getElementById("endTime").value
    const validateTime = await isEndGreater(startVal, endVal)
    let isStartTimeValid = startVal.match(/^(\d{2,}):([0-5][0-9]):([0-5][0-9])$/) !== null
    let isEndTimeValid = endVal.match(/^(\d{2,}):([0-5][0-9]):([0-5][0-9])$/) !== null

    if (!validateTime) {
      isStartTimeValid = false
      isEndTimeValid = false
    }

    if (selectedRes !== "" && isStartTimeValid && isEndTimeValid && validateTime) {
      const currentVOD = vods.find(vod => vod.video.uuid === selectedUUID);
      axios.post("/api/download", {
        source: selectedVOD,
        uuid: selectedUUID,
        title: (() => {
          try {
            let streamerName = inputData.includes("kick.com/") ? inputData.split("kick.com/")[1].split("/")[0] : inputData;
            let dateStr = currentVOD?.start_time ? new Date(currentVOD.start_time).toISOString().split('T')[0] : "date";
            let durationStr = "duration";
            if (!entireVOD && startVal && endVal) {
              let diff = timeToSeconds(endVal) - timeToSeconds(startVal);
              durationStr = secondsToTime(diff).replace(/:/g, "-");
            } else if (currentVOD?.duration) {
              durationStr = secondsToTime(Math.floor(currentVOD.duration / 1000)).replace(/:/g, "-");
            }
            return `${streamerName}_${dateStr}_${durationStr}`;
          } catch (e) {
            return currentVOD?.session_title || "stream";
          }
        })(),
        resolution: selectedRes,
        entireVOD: entireVOD,
        audioOnly: audioOnly,
        startTime: startVal,
        endTime: endVal,
        language: language
      }, []).then((resp) => {
        if (!resp.data.cancel) {
          cancelButton(selectedUUID)
          toast(t('downloading'), {
            description: `${t('withRes')} ${selectedRes}`,
            action: {
              label: t('cancel'),
              onClick: () => cancelDownload({ uuid: selectedUUID }),
            },
          })
        }
      })
    } else {
      cancelResDialog()

      let toastTitle = t('invalidTime')
      let toastDesc = t('invalidTimeDesc')

      if ((isEndTimeValid || isStartTimeValid) && selectedRes === "") {
        toastTitle = t('noResolution')
        toastDesc = t('noResolutionDesc')
      }

      toast(toastTitle, {
        description: toastDesc,
        action: {
          label: t('close'),
          onClick: () => { },
        },
      })
    }
  }


  const cancelDownload = async (data) => {
    axios.post("/api/cancel", data, []).then((response) => {
      if (response.data.status !== "nochange") {
        downloadButton(data.uuid)

        // Hide progress UI
        const progressElement = document.getElementById('progress-' + data.uuid)
        const textElement = document.getElementById('progress-text-' + data.uuid)
        if (progressElement) progressElement.style.display = "none"
        if (textElement) textElement.style.display = "none"
        document.title = t('title')

        toast(t('downloadCancelled'), {
          description: t('downloadCancelledDesc'),
          action: {
            label: t('close'),
            onClick: () => { },
          },
        })
      }
    })
  }

  const cancelResDialog = async () => {
    setSelectedRes("")
    setResOpenState(false)
    setEntireVOD(true)
  }

  const settingsDialog = async (event) => {
    setSelectedRes("")
    setAudioOnly(false)
    setResOpenState(event)
    setEntireVOD(!event)
  }

  const cancelDetailsDialog = async () => setDetailsOpenState(false)

  const fetchVODProperties = async (vodID) => {
    try {
      let res = await axios.get(`${kickAPI}video/${vodID}`)
      return res.data
    } catch (e) {
      console.log(e)
    }
  }

  const detailsDialog = async (event) => {
    selectedDetails.current = (event.currentTarget.getAttribute("data-uuid"))
    setDetailsOpenState(true)
    setDetails({})
    setPrevTime(Date.now())
    setRemainingData("")
    setRemaining("")
    setSegments("")
  }

  const handleInputChange = (event) => {
    setInputData(event.target.value)
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen p-4 md:p-8 flex flex-col items-center space-y-12"
    >
      <Toaster />

      {/* Header */}
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        className="text-center space-y-4 relative w-full flex flex-col items-center"
      >
        <div className="absolute right-4 top-0 flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/10">
          <button
            onClick={() => setLanguage('cz')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${language === 'cz' ? 'bg-primary text-black' : 'text-muted-foreground hover:text-white'}`}
          >
            CZ
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${language === 'en' ? 'bg-primary text-black' : 'text-muted-foreground hover:text-white'}`}
          >
            EN
          </button>
        </div>
        <h1 className="text-5xl font-black tracking-tighter text-white drop-shadow-2xl">
          KICK <span className="text-primary">VOD</span> DOWNLOADER
        </h1>
        <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">
          {t('subtitle')}
        </p>
      </motion.div>

      {/* Background Decor for Search Area */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 pointer-events-none -z-10">
        <div className="absolute top-0 left-10 w-48 h-48 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-10 w-64 h-64 bg-primary/5 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* Main Input Area */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="w-full max-w-2xl px-4"
      >
        <Card className="glass-dark border-white/5 overflow-hidden relative group hover:border-primary/20 transition-all duration-500 shadow-2xl shadow-black/40">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-50" />
          <form onSubmit={(e) => { e.preventDefault(); fetchVODs(); }}>
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
                {t('streamSearch')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative group flex-1">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors">
                    <Search size={18} />
                  </div>
                  <Input
                    type="text"
                    value={inputData}
                    placeholder={t('placeholder')}
                    onChange={handleInputChange}
                    className="h-12 bg-white/[0.03] border-white/10 hover:bg-white/[0.05] pl-11 pr-5 rounded-2xl focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all placeholder:text-muted-foreground/30 text-base"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-primary/3 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity" />
                </div>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-12 rounded-2xl shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0 relative overflow-hidden group/btn"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {t('fetchVods')}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </motion.div>

      {/* VOD Grid */}
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1980px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-8">
          <AnimatePresence mode="popLayout">
            {vods.map((vod, i) => {
              return (
                <motion.div
                  key={vod.video.uuid}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-dark border-white/10 rounded-3xl overflow-hidden group hover:border-primary/40 transition-colors"
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-video overflow-hidden">
                    <span
                      id={"timestamp-" + vod.video.uuid}
                      className="absolute top-3 right-3 z-10 text-white bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-normal"
                    >
                      {new Date(vod.duration).toUTCString().match("..:..:..")[0]}
                    </span>
                    <Image
                      className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                      src={vod.thumbnail.src}
                      alt="Thumbnail"
                      width={1280}
                      height={720}
                      unoptimized={true}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-4">
                    <div className="space-y-2">
                      <h3 className="line-clamp-2 font-medium text-lg leading-tight min-h-[3rem]">
                        {vod.session_title}
                      </h3>
                      <p className="text-xs text-muted-foreground font-normal uppercase tracking-wider">
                        {formatDate(vod.start_time || vod.created_at)}
                      </p>
                    </div>

                    {/* Progress Area */}
                    <div className="space-y-2">
                      <ProgressPrimitive.Root
                        style={{ "display": "none" }}
                        id={"progress-" + vod.video.uuid}
                        className={"h-2 w-full overflow-hidden rounded-full bg-white/10"}
                      >
                        <ProgressPrimitive.Indicator
                          className="h-full w-full flex-1 bg-primary relative overflow-hidden"
                          style={{ transform: 'translateX(-100%)' }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </ProgressPrimitive.Indicator>
                      </ProgressPrimitive.Root>

                      <div id={"progress-text-" + vod.video.uuid} className="text-xs font-bold text-primary animate-pulse" style={{ "display": "none" }}>0%</div>

                      <motion.span
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs font-bold text-green-400"
                        id={"downloaded-" + vod.video.uuid}
                        style={{ "display": "none" }}
                      >
                        {t('downloaded')}
                      </motion.span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1 bg-white hover:bg-white/90 text-black font-medium h-11 rounded-xl group/btn overflow-hidden relative"
                        id={"button-" + vod.video.uuid}
                        data-state="download"
                        data-uuid={vod.video.uuid}
                        onClick={buttonEventSelection}
                      >
                        <span className="relative z-10">{t('download')}</span>
                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      </Button>
                      <Button
                        className="bg-white/10 hover:bg-white/20 text-white font-medium h-11 rounded-xl px-4"
                        id={"details-button-" + vod.video.uuid}
                        style={{ "display": "none" }}
                        data-uuid={vod.video.uuid}
                        onClick={detailsDialog}
                      >
                        {t('details')}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
      <AlertDialog open={resOpenState} onOpenChange={settingsDialog}>
        <AlertDialogContent className="max-w-md glass-dark border-primary/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold tracking-tight">{t('settingsTitle')}</AlertDialogTitle>
          </AlertDialogHeader>

          <div className="flex flex-col gap-6 py-4">
            <div className="space-y-3">
              <Label className="text-xs font-normal uppercase tracking-wider text-muted-foreground ml-1">{t('resolution')}</Label>
              <Select onValueChange={(val) => {
                if (val === "audio") {
                  setAudioOnly(true)
                  setSelectedRes("audio")
                } else {
                  setAudioOnly(false)
                  setSelectedRes(val)
                }
              }}>
                <SelectTrigger className="w-full h-11 bg-white/5 border-white/10 rounded-xl focus:ring-primary/50">
                  <SelectValue placeholder={t('resolution')} />
                </SelectTrigger>
                <SelectContent className="glass-dark border-white/10">
                  <SelectGroup>
                    {resolutions.map((res, i) => (
                      <SelectItem key={i} value={res} className="focus:bg-primary focus:text-black font-medium uppercase tracking-tight">
                        {res.replace("p", "p ")}fps
                      </SelectItem>
                    ))}
                    <SelectItem value="audio" className="focus:bg-primary focus:text-black font-medium tracking-tight">
                      {t('audioOnly')}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-3 bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-primary/30 transition-colors group cursor-pointer" onClick={() => setEntireVOD(!entireVOD)}>
              <Checkbox id="entireVOD" checked={entireVOD} onCheckedChange={setEntireVOD} className="data-[state=checked]:bg-primary data-[state=checked]:text-black border-white/20" />
              <Label htmlFor="entireVOD" className="cursor-pointer font-bold text-sm group-hover:text-primary transition-colors">{t('downloadEntireVod')}</Label>
            </div>

            {!entireVOD && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-6 pt-2 overflow-hidden"
              >
                <div className="space-y-4 px-1">
                  <div className="flex justify-between items-end">
                    <Label className="text-xs font-normal uppercase tracking-widest text-muted-foreground">{t('trimming')}</Label>
                    <span className="text-[10px] font-mono text-primary/70">{secondsToTime(range[1] - range[0])}</span>
                  </div>
                  <Slider
                    value={range}
                    max={maxSeconds}
                    step={1}
                    minStepsBetweenThumbs={1}
                    onValueChange={(val) => {
                      setRange(val)
                      // Manual update for inputs if they are in DOM
                      const startInput = document.getElementById("startTime")
                      const endInput = document.getElementById("endTime")
                      if (startInput) startInput.value = secondsToTime(val[0])
                      if (endInput) endInput.value = secondsToTime(val[1])
                    }}
                    className="py-4"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-muted-foreground/60">
                    <span>{secondsToTime(range[0])}</span>
                    <span>{secondsToTime(range[1])}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime" className="text-[10px] uppercase font-normal tracking-widest text-muted-foreground ml-1">{t('start')}</Label>
                    <Input
                      id="startTime"
                      defaultValue="00:00:00"
                      className="h-10 bg-white/5 border-white/10 font-mono text-sm rounded-xl focus:ring-primary/50"
                      onChange={(e) => {
                        const sec = timeToSeconds(e.target.value)
                        if (!isNaN(sec)) setRange([sec, range[1]])
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime" className="text-[10px] uppercase font-normal tracking-widest text-muted-foreground ml-1">{t('end')}</Label>
                    <Input
                      id="endTime"
                      defaultValue={VODEndTime}
                      className="h-10 bg-white/5 border-white/10 font-mono text-sm rounded-xl focus:ring-primary/50"
                      onChange={(e) => {
                        const sec = timeToSeconds(e.target.value)
                        if (!isNaN(sec)) setRange([range[0], sec])
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel onClick={cancelResDialog} className="h-11 rounded-xl border-white/10 hover:bg-white/10 hover:text-primary font-normal transition-all">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={downloadVOD} disabled={selectedRes === ""} className="bg-primary hover:bg-primary/90 text-black font-medium h-11 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">{t('download')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={detailsOpenState} onOpenChange={setDetailsOpenState}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('details')}</AlertDialogTitle>
            <AlertDialogDescription>{t('fileSize')}: {details.fileSize || "—"}</AlertDialogDescription>
            <AlertDialogDescription>{t('segments')}: {segments || "—"}</AlertDialogDescription>
            <AlertDialogDescription>{t('remaining')}: {remaining || "—"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDetailsDialog}>{t('close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.main>
  )
}