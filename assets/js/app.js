// If you want to use Phoenix channels, run `mix help phx.gen.channel`
// to get started and then uncomment the line below.
// import "./user_socket.js"

// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `npm install some-package --prefix assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//
// If you have dependencies that try to import CSS, esbuild will generate a separate `app.css` file.
// To load it, simply add a second `<link>` to your `root.html.heex` file.

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html"
// Establish Phoenix Socket and LiveView configuration.
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import {hooks as colocatedHooks} from "phoenix-colocated/grup_yorum_halktir_phoenix"
import topbar from "../vendor/topbar"

// Session ID Manager - persists across page refreshes
const SessionManager = {
  getSessionId() {
    let sessionId = localStorage.getItem("player_session_id")
    if (!sessionId) {
      // Generate a UUID v4
      sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
      localStorage.setItem("player_session_id", sessionId)
    }
    return sessionId
  },
  
  getTrackDurations() {
    const durationsJson = localStorage.getItem("track_durations")
    return durationsJson ? JSON.parse(durationsJson) : {}
  },
  
  saveTrackDuration(trackId, duration) {
    const durations = this.getTrackDurations()
    durations[trackId] = duration
    localStorage.setItem("track_durations", JSON.stringify(durations))
  }
}

// Audio Player Hook
const AudioPlayer = {
  mounted() {
    this.audio = this.el
    this.lastSrc = ""
    this.lastDuration = null
    
    // Send stable session ID to LiveView
    const stableSessionId = SessionManager.getSessionId()
    if (stableSessionId) {
      this.pushEvent("set-session-id", {"session_id": stableSessionId})
    }
    
    // Load and send cached track durations
    const cachedDurations = SessionManager.getTrackDurations()
    if (Object.keys(cachedDurations).length > 0) {
      this.pushEvent("load-track-durations", {"durations": cachedDurations})
    }
    
    this.handleEvent("play", () => {
      try {
        if (!this.audio) return
        
        // Wait for audio to be ready before playing
        const tryPlay = () => {
          if (!this.audio) return
          
          // Only play if audio has a valid src and is ready
          if (this.audio.src && this.audio.src !== "" && this.audio.readyState >= 2) {
            this.audio.play().catch(err => {
              // Silently handle play errors (e.g., user interaction required)
              console.error("Play failed:", err)
            })
          } else if (this.audio.src && this.audio.src !== "") {
            // If src is set but not ready, wait for it
            let retryCount = 0
            const maxRetries = 10
            const waitAndPlay = () => {
              if (retryCount >= maxRetries || !this.audio) {
                return
              }
              if (this.audio.readyState >= 2) {
                this.audio.play().catch(err => {
                  console.error("Play failed:", err)
                })
              } else {
                retryCount++
                setTimeout(waitAndPlay, 100)
              }
            }
            this.audio.addEventListener("canplay", waitAndPlay, { once: true })
            waitAndPlay()
          }
        }
        
        // If audio is already ready, play immediately
        if (this.audio.readyState >= 2) {
          tryPlay()
        } else {
          // Otherwise wait for it to be ready
          this.audio.addEventListener("canplay", tryPlay, { once: true })
        }
      } catch (err) {
        console.error("Error in play handler:", err)
      }
    })
    this.handleEvent("pause", () => {
      this.audio.pause()
    })
    this.handleEvent("set-volume", ({volume}) => {
      this.audio.volume = volume
    })
    this.handleEvent("seek", ({position}) => {
      // Wait for audio to be ready before seeking
      if (this.audio.readyState >= 2) {
        this.audio.currentTime = position
      } else {
        // Wait for metadata to load
        const seekWhenReady = () => {
          if (this.audio.readyState >= 2) {
            this.audio.currentTime = position
          } else {
            setTimeout(seekWhenReady, 100)
          }
        }
        this.audio.addEventListener("canplay", seekWhenReady, { once: true })
        seekWhenReady()
      }
    })
    this.handleEvent("seek-and-play", ({position}) => {
      // Seek first, then play when ready
      const seekAndPlay = () => {
        if (!this.audio) return
        
        // Set position
        if (position !== undefined && position !== null) {
          this.audio.currentTime = position
        }
        
        // Wait a moment for seek to complete, then play
        const playAfterSeek = () => {
          if (this.audio && this.audio.readyState >= 2) {
            this.audio.play().catch(err => {
              console.error("Play failed:", err)
            })
          } else {
            // Wait for audio to be ready
            const waitAndPlay = () => {
              if (this.audio && this.audio.readyState >= 2) {
                this.audio.play().catch(err => {
                  console.error("Play failed:", err)
                })
              } else if (this.audio) {
                setTimeout(waitAndPlay, 100)
              }
            }
            this.audio.addEventListener("canplay", waitAndPlay, { once: true })
            waitAndPlay()
          }
        }
        
        // Small delay to ensure seek completes
        setTimeout(playAfterSeek, 50)
      }
      
      // Wait for audio to be ready before seeking
      if (this.audio.readyState >= 2) {
        seekAndPlay()
      } else {
        this.audio.addEventListener("canplay", seekAndPlay, { once: true })
      }
    })
    this.handleEvent("set-src", ({src, position}) => {
      if (src && src !== "" && src !== this.lastSrc) {
        this.lastSrc = src
        this.lastDuration = null // Reset lastDuration on new track
        this.audio.pause()
        this.audio.src = src
        this.audio.load()
        // Set volume after loading
        if (this.el.dataset.volume) {
          this.audio.volume = parseFloat(this.el.dataset.volume)
        }
        // Don't reset duration display here - let LiveView handle it
        // Wait for audio to be ready before seeking
        this.audio.addEventListener("canplay", () => {
          // Seek to position if provided
          if (position !== undefined && position !== null) {
            this.audio.currentTime = position
          }
        }, { once: true })
      }
    })

    // Sync volume from initial state
    const volumeEvent = this.el.dataset.volume
    if (volumeEvent) {
      this.audio.volume = parseFloat(volumeEvent)
    }

    // Time update - update UI directly without pushing to server
    // Only push to server periodically to save position
    this.timeupdateThrottle = null
    this.lastSavedPosition = 0
    this.audio.addEventListener("timeupdate", () => {
      try {
        if (!this.audio) return
        
        // Update seek bar locally without server roundtrip
        const seekBar = document.getElementById("seek-bar")
        if (seekBar && !seekBar.matches(":active")) {
          const max = this.audio.duration || 100
          seekBar.max = max
          seekBar.value = this.audio.currentTime || 0
        }
        
        // Update time display locally
        const formatTime = (seconds) => {
          const totalSeconds = Math.floor(seconds)
          const minutes = Math.floor(totalSeconds / 60)
          const secs = totalSeconds % 60
          return `${minutes}:${String(secs).padStart(2, '0')}`
        }
        
        const timeDisplay = document.querySelector('[data-time-display]')
        if (timeDisplay) {
          timeDisplay.textContent = formatTime(this.audio.currentTime)
        }
        
        // Update duration display
        const durationDisplay = document.querySelector('[data-duration-display]')
        if (durationDisplay && this.audio.duration && !isNaN(this.audio.duration)) {
          durationDisplay.textContent = formatTime(this.audio.duration)
          // Also send to LiveView if it changed
          if (!this.lastDuration || Math.abs(this.lastDuration - this.audio.duration) > 0.5) {
            this.lastDuration = this.audio.duration
            const trackId = this.el.dataset.trackId
            if (trackId) {
              SessionManager.saveTrackDuration(trackId, this.audio.duration)
              this.pushEvent("audio-duration", {
                "duration": this.audio.duration,
                "track_id": trackId
              })
            }
          }
        }
        
        // Update track time display in track list (only current time, preserve duration)
        const currentTrackId = this.el.dataset.trackId
        if (currentTrackId) {
          const currentTimeElements = document.querySelectorAll(`[data-track-current-time="${currentTrackId}"]`)
          currentTimeElements.forEach(el => {
            el.textContent = formatTime(this.audio.currentTime)
          })
          
          // Update duration if it changed
          if (this.audio.duration && !isNaN(this.audio.duration)) {
            const durationElements = document.querySelectorAll(`[data-track-duration="${currentTrackId}"]`)
            durationElements.forEach(el => {
              if (el.textContent === "--:--" || el.textContent.includes("--")) {
                el.textContent = formatTime(this.audio.duration)
              }
            })
          }
        }
        
        // Save position periodically (every 2 seconds) to avoid spam
        if (!this.timeupdateThrottle) {
          this.timeupdateThrottle = setTimeout(() => {
            const currentTime = this.audio.currentTime || 0
            // Only save if position changed significantly (more than 1 second)
            if (Math.abs(currentTime - this.lastSavedPosition) > 1.0) {
              this.lastSavedPosition = currentTime
              this.pushEvent("audio-timeupdate", {
                "current-time": currentTime
              })
            }
            this.timeupdateThrottle = null
          }, 2000) // Save every 2 seconds
        }
      } catch (err) {
        // Silently handle errors in timeupdate
      }
    })
    
    // Update duration when metadata loads
    this.audio.addEventListener("loadedmetadata", () => {
      try {
        if (!this.audio) return
        
        const formatTime = (seconds) => {
          const totalSeconds = Math.floor(seconds)
          const minutes = Math.floor(totalSeconds / 60)
          const secs = totalSeconds % 60
          return `${minutes}:${String(secs).padStart(2, '0')}`
        }
        
        const durationDisplay = document.querySelector('[data-duration-display]')
        if (durationDisplay && this.audio.duration && !isNaN(this.audio.duration)) {
          durationDisplay.textContent = formatTime(this.audio.duration)
        }
        
        // Update track duration display in track list
        const currentTrackId = this.el.dataset.trackId
        if (currentTrackId && this.audio.duration && !isNaN(this.audio.duration)) {
          const trackDurationElements = document.querySelectorAll(`[data-track-duration="${currentTrackId}"]`)
          trackDurationElements.forEach(el => {
            // Only update if it's still "--:--" or if LiveView hasn't set it yet
            if (el.textContent === "--:--" || el.textContent.includes("--")) {
              el.textContent = formatTime(this.audio.duration)
            }
          })
        }
        
        // Update seek bar max
        const seekBar = document.getElementById("seek-bar")
        if (seekBar) {
          seekBar.max = this.audio.duration || 100
        }
        
        // Send duration to LiveView
        if (this.audio.duration && !isNaN(this.audio.duration)) {
          const trackId = this.el.dataset.trackId
          if (trackId) {
            SessionManager.saveTrackDuration(trackId, this.audio.duration)
            this.pushEvent("audio-duration", {
              "duration": this.audio.duration,
              "track_id": trackId
            })
          }
        }
      } catch (err) {
        // Silently handle errors
      }
    })

    // Track ended - notify LiveView
    this.audio.addEventListener("ended", () => {
      try {
        this.pushEvent("audio-ended", {})
      } catch (err) {
        console.error("Error pushing audio-ended event:", err)
      }
    })

    // Sync play/pause state
    this.handleEvent("sync-playing", ({is_playing}) => {
      if (is_playing && this.audio.paused && this.audio.src && this.audio.src !== "" && this.audio.readyState >= 2) {
        this.audio.play().catch(err => console.error("Play failed:", err))
      } else if (!is_playing && !this.audio.paused) {
        this.audio.pause()
      }
    })

    // Watch for src changes in DOM (when LiveView updates the src attribute)
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "src") {
          const newSrc = this.el.getAttribute("src")
          if (newSrc && newSrc !== "" && newSrc !== this.lastSrc) {
            this.lastSrc = newSrc
            this.audio.pause()
            this.audio.src = newSrc
            this.audio.load()
            if (this.el.dataset.volume) {
              this.audio.volume = parseFloat(this.el.dataset.volume)
            }
          }
        }
        if (mutation.type === "attributes" && mutation.attributeName === "data-volume") {
          const volume = this.el.dataset.volume
          if (volume) {
            this.audio.volume = parseFloat(volume)
          }
        }
      })
    })
    this.observer.observe(this.el, {attributes: true, attributeFilter: ["src", "data-volume"]})
    
    // Initialize lastSrc
    const initialSrc = this.el.getAttribute("src")
    if (initialSrc && initialSrc !== "") {
      this.lastSrc = initialSrc
    }
  },
  updated() {
    try {
      if (!this.audio) return
      
      // Sync volume on update
      if (this.el.dataset.volume) {
        this.audio.volume = parseFloat(this.el.dataset.volume)
      }
      // Check if src changed (when LiveView updates the template)
      const currentSrcAttr = this.el.getAttribute("src")
      if (currentSrcAttr && currentSrcAttr !== "" && currentSrcAttr !== this.lastSrc) {
        this.lastSrc = currentSrcAttr
        this.audio.pause()
        this.audio.src = currentSrcAttr
        this.audio.load()
        if (this.el.dataset.volume) {
          this.audio.volume = parseFloat(this.el.dataset.volume)
        }
      }
    } catch (err) {
      console.error("Error in AudioPlayer updated:", err)
    }
  },
  destroyed() {
    if (this.observer) {
      this.observer.disconnect()
    }
    if (this.timeupdateThrottle) {
      clearTimeout(this.timeupdateThrottle)
    }
  }
}

// Seek Bar Hook
const SeekBar = {
  mounted() {
    this.findAudio()
    
    this.el.addEventListener("input", (e) => {
      const position = parseFloat(e.target.value)
      if (this.audio) {
        this.audio.currentTime = position
      }
      // Don't push event immediately - wait for user to release
    })
    
    // Push event only when user releases the slider
    this.el.addEventListener("change", (e) => {
      const position = parseFloat(e.target.value)
      this.pushEvent("seek", {position})
    })

    // Watch for audio element creation
    this.audioObserver = new MutationObserver(() => {
      if (!this.audio || !document.contains(this.audio)) {
        this.findAudio()
      }
    })
    this.audioObserver.observe(document.body, {childList: true, subtree: true})
  },
  updated() {
    this.findAudio()
    if (this.audio) {
      const max = this.audio.duration || 100
      this.el.max = max
      if (!this.el.matches(":active")) {
        this.el.value = this.audio.currentTime || 0
      }
    }
  },
  destroyed() {
    if (this.audioObserver) {
      this.audioObserver.disconnect()
    }
  },
  findAudio() {
    this.audio = document.getElementById("audio-player")
  }
}

// Volume Slider Hook
const VolumeSlider = {
  mounted() {
    this.findAudio()
    
    this.el.addEventListener("input", (e) => {
      const volume = parseFloat(e.target.value)
      this.updateAudioVolume(volume)
      // Don't push event immediately - wait for user to release
    })
    
    // Push event only when user releases the slider
    this.el.addEventListener("change", (e) => {
      const volume = parseFloat(e.target.value)
      this.pushEvent("volume-change", {volume})
    })
    
    // Watch for audio element creation
    this.audioObserver = new MutationObserver(() => {
      if (!this.audio || !document.contains(this.audio)) {
        this.findAudio()
      }
    })
    this.audioObserver.observe(document.body, {childList: true, subtree: true})
  },
  updated() {
    this.findAudio()
    if (this.audio && !this.el.matches(":active")) {
      this.el.value = this.audio.volume || 1.0
    }
  },
  destroyed() {
    if (this.audioObserver) {
      this.audioObserver.disconnect()
    }
    if (this.volumeTimeout) {
      clearTimeout(this.volumeTimeout)
    }
  },
  findAudio() {
    this.audio = document.getElementById("audio-player")
  },
  updateAudioVolume(volume) {
    if (this.audio) {
      this.audio.volume = volume
    }
  }
}

// Track List Preloader Hook - Preloads metadata for all tracks
const TrackListPreloader = {
  mounted() {
    // Store active audio elements to cancel them if needed
    this.activeAudioElements = new Set()
    // Only run if this element is visible (to avoid duplicate work)
    if (this.isVisible()) {
      // Check if we even need to preload (only if there are tracks without durations)
      const knownDurationsData = this.el.dataset.knownDurations
      let knownDurations = {}
      if (knownDurationsData) {
        try {
          knownDurations = JSON.parse(knownDurationsData)
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      const tracksData = this.el.dataset.tracks
      if (tracksData) {
        const tracks = JSON.parse(tracksData)
        const cachedDurations = SessionManager.getTrackDurations()
        
        // Check if any tracks need preloading
        const needsPreload = tracks.some(track => {
          const trackId = track.id
          return !(cachedDurations[trackId] || cachedDurations[trackId.toString()] || knownDurations[trackId] || knownDurations[trackId.toString()])
        })
        
        // Only preload if absolutely necessary, and defer it significantly
        if (needsPreload) {
          // Delay preloading significantly to let page load first
          setTimeout(() => {
            if (this.isVisible()) {
              this.preloadDurations()
            }
          }, 2000) // 2 second delay - let page render first
        }
      }
    }
  },
  updated() {
    // Only re-preload if tracks changed AND element is visible
    // Check if tracks data actually changed to avoid unnecessary work
    const currentTracksData = this.el.dataset.tracks
    if (currentTracksData !== this.lastTracksData && this.isVisible()) {
      // Cancel any ongoing preloads first
      this.cancelAllPreloads()
      // Only update if tracks actually changed
      this.lastTracksData = currentTracksData
      // Don't automatically re-preload on update - let user interactions trigger it if needed
    }
  },
  destroyed() {
    // Clean up all active audio elements
    this.cancelAllPreloads()
  },
  cancelAllPreloads() {
    // Cancel all active audio element loads
    this.activeAudioElements.forEach(audio => {
      try {
        audio.pause()
        audio.src = ""
        audio.load()
        audio.removeEventListener("loadedmetadata", audio._metadataHandler)
        audio.removeEventListener("error", audio._errorHandler)
      } catch (e) {
        // Ignore errors during cleanup
      }
    })
    this.activeAudioElements.clear()
  },
  isVisible() {
    // Check if element is actually visible (not hidden by CSS)
    const style = window.getComputedStyle(this.el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  },
  preloadDurations() {
    try {
      const tracksData = this.el.dataset.tracks
      if (!tracksData) return
      
      const tracks = JSON.parse(tracksData)
      if (!Array.isArray(tracks) || tracks.length === 0) return
      
      // Get cached durations from localStorage
      const cachedDurations = SessionManager.getTrackDurations()
      
      // Get known durations from LiveView (already in database)
      const knownDurationsData = this.el.dataset.knownDurations
      let knownDurations = {}
      if (knownDurationsData) {
        try {
          knownDurations = JSON.parse(knownDurationsData)
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Filter tracks that need preloading
      const tracksToPreload = tracks.filter(track => {
        const trackId = track.id
        return !(cachedDurations[trackId] || cachedDurations[trackId.toString()] || knownDurations[trackId] || knownDurations[trackId.toString()])
      })
      
      // If all tracks already have durations, skip preloading entirely
      if (tracksToPreload.length === 0) {
        return
      }
      
      // Limit concurrent preloads to avoid overwhelming the browser
      const MAX_CONCURRENT = 1  // Reduced to 1 to minimize network impact
      let activePreloads = 0
      let preloadQueue = [...tracksToPreload]
      
      const processNext = () => {
        if (preloadQueue.length === 0 || activePreloads >= MAX_CONCURRENT) {
          return
        }
        
        const track = preloadQueue.shift()
        activePreloads++
        
        const trackId = track.id
        const fileUrl = track.file_url
        
        // Create a temporary audio element to load ONLY metadata
        const audio = new Audio()
        audio.preload = "metadata"  // Only load metadata, not the whole file
        
        // Store handlers so we can remove them later
        const metadataHandler = () => {
          try {
            if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
              // Save to localStorage
              SessionManager.saveTrackDuration(trackId, audio.duration)
              
              // Send to LiveView
              if (this.pushEvent) {
                this.pushEvent("audio-duration", {
                  "duration": audio.duration,
                  "track_id": trackId.toString()
                })
              }
              
              // Update the display element if it exists
              const displayElement = document.querySelector(`[data-track-time="${trackId}"]`)
              if (displayElement && !displayElement.textContent.includes('/')) {
                const formatTime = (seconds) => {
                  const totalSeconds = Math.floor(seconds)
                  const minutes = Math.floor(totalSeconds / 60)
                  const secs = totalSeconds % 60
                  return `${minutes}:${String(secs).padStart(2, '0')}`
                }
                displayElement.textContent = formatTime(audio.duration)
              }
            }
          } catch (err) {
            // Silently handle errors
          } finally {
            // Clean up immediately after getting metadata
            this.cleanupAudio(audio)
            activePreloads--
            // Process next in queue with delay
            setTimeout(processNext, 500) // Increased delay to 500ms between requests
          }
        }
        
        const errorHandler = () => {
          this.cleanupAudio(audio)
          activePreloads--
          setTimeout(processNext, 500)
        }
        
        // Stop the audio immediately after metadata loads
        const stopAfterMetadata = () => {
          try {
            audio.pause()
            audio.currentTime = 0
          } catch (e) {
            // Ignore errors
          }
        }
        
        audio._metadataHandler = metadataHandler
        audio._errorHandler = errorHandler
        
        audio.addEventListener("loadedmetadata", () => {
          metadataHandler()
          stopAfterMetadata()
        }, { once: true })
        audio.addEventListener("error", errorHandler, { once: true })
        
        // Add to active set
        this.activeAudioElements.add(audio)
        
        // Set src AFTER listeners are attached
        audio.src = fileUrl
        
        // Process next after delay
        setTimeout(processNext, 500)
      }
      
      // Start processing with initial delay
      if (tracksToPreload.length > 0) {
        // Only start one at a time
        setTimeout(processNext, 500)
      }
    } catch (err) {
      // Silently handle errors
    }
  },
  cleanupAudio(audio) {
    try {
      audio.pause()
      audio.src = ""
      audio.load()
      audio.removeEventListener("loadedmetadata", audio._metadataHandler)
      audio.removeEventListener("error", audio._errorHandler)
      this.activeAudioElements.delete(audio)
    } catch (e) {
      // Ignore errors during cleanup
    }
  }
}

const csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
const liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: {_csrf_token: csrfToken},
  hooks: {
    ...colocatedHooks,
    AudioPlayer,
    SeekBar,
    VolumeSlider,
    TrackListPreloader
  },
})

// Show progress bar on live navigation and form submits
topbar.config({barColors: {0: "#29d"}, shadowColor: "rgba(0, 0, 0, .3)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())

// connect if there are any LiveViews on the page
liveSocket.connect()

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket

// The lines below enable quality of life phoenix_live_reload
// development features:
//
//     1. stream server logs to the browser console
//     2. click on elements to jump to their definitions in your code editor
//
if (process.env.NODE_ENV === "development") {
  window.addEventListener("phx:live_reload:attached", ({detail: reloader}) => {
    // Enable server log streaming to client.
    // Disable with reloader.disableServerLogs()
    reloader.enableServerLogs()

    // Open configured PLUG_EDITOR at file:line of the clicked element's HEEx component
    //
    //   * click with "c" key pressed to open at caller location
    //   * click with "d" key pressed to open at function component definition location
    let keyDown
    window.addEventListener("keydown", e => keyDown = e.key)
    window.addEventListener("keyup", e => keyDown = null)
    window.addEventListener("click", e => {
      if(keyDown === "c"){
        e.preventDefault()
        e.stopImmediatePropagation()
        reloader.openEditorAtCaller(e.target)
      } else if(keyDown === "d"){
        e.preventDefault()
        e.stopImmediatePropagation()
        reloader.openEditorAtDef(e.target)
      }
    }, true)

    window.liveReloader = reloader
  })
}


