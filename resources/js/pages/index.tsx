import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Head } from '@inertiajs/react'
import { Card, CardContent } from '@/components/ui/card'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Loader2, Music, List, Disc } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'

interface Track {
  track: number
  title: string
  file: string
  disc?: number
}

interface Album {
  id: number
  title: string
  year: number
  slug: string
  cover: string
  trackCount: number
  tracks: Track[]
  description?: string
}

interface AlbumsData {
  artist: string
  totalAlbums: number
  albums: Album[]
}

interface PageProps {
  minioPublicUrl: string
}

export default function Index({ minioPublicUrl }: PageProps) {
  const [albumsData, setAlbumsData] = useState<AlbumsData | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [volume, setVolume] = useState(() => {
    // localStorage'dan volume'u oku, yoksa default 75 kullan
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('grup-yorum-volume')
      return savedVolume ? [parseInt(savedVolume)] : [75]
    }
    return [75]
  })
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false)
  const [trackEnded, setTrackEnded] = useState(false)
  const [mobileView, setMobileView] = useState<'albums' | 'tracks'>('albums')
  
  const isMobile = useIsMobile()
  const audioRef = useRef<HTMLAudioElement>(null)

  // Load albums metadata
  useEffect(() => {
    fetch('/all_albums_metadata.json')
      .then(response => response.json())
      .then((data: AlbumsData) => {
        setAlbumsData(data)
        // Select first album by default
        if (data.albums.length > 0) {
          const firstAlbum = data.albums[0]
          setSelectedAlbum(firstAlbum)
          
          // İlk albümün ilk şarkısını hazırla (ama çalma)
          if (firstAlbum.tracks.length > 0) {
            setCurrentTrack(firstAlbum.tracks[0])
          }
          
          console.log('🎵 Initial album and track set:', firstAlbum.title)
        }
      })
      .catch(error => console.error('Error loading albums:', error))
  }, [])

  // Audio URL'ini hazırla - currentTrack veya selectedAlbum değiştiğinde
  useEffect(() => {
    if (currentTrack && audioRef.current && minioPublicUrl && albumsData) {
      // CurrentTrack'in gerçek albümünü bul
      const trackAlbum = albumsData.albums.find(album => 
        album.tracks.some(track => track.file === currentTrack.file)
      )
      
      if (!trackAlbum) return
      
      const trackUrl = `${minioPublicUrl}/albums/${trackAlbum.year}-${trackAlbum.slug}/tracks/${currentTrack.file}`
      
      console.log('🔗 Current audio src:', audioRef.current.src)
      console.log('🔗 New track URL:', trackUrl)
      console.log('🔗 shouldAutoPlay:', shouldAutoPlay)
      
      // URL'i normalize et (karşılaştırma için)
      const currentSrc = audioRef.current.src
      const isSameTrack = currentSrc === trackUrl
      
      if (!isSameTrack) {
        console.log('✅ Setting new audio URL')
        audioRef.current.src = trackUrl
        
        // Audio URL set edildiğinde volume'u da set et (audio kesinlikle hazır)
        const linearVolume = volume[0] / 100
        const curvedVolume = Math.pow(linearVolume, 2)
        audioRef.current.volume = curvedVolume
        audioRef.current.muted = false
        console.log(`🔊 Volume set with URL: ${volume[0]}% -> ${(curvedVolume * 100).toFixed(1)}%`)
        
        // Auto play ise çal
        if (shouldAutoPlay) {
          console.log('🚀 Auto-playing new track')
          audioRef.current.play().catch(err => {
            console.error('❌ Auto-play failed:', err)
            setIsLoading(false)
          })
          setShouldAutoPlay(false) // Reset flag
        }
      } else {
        console.log('⏭️ Same track URL, skipping')
        // Aynı track ama auto-play flag set ise, play et
        if (shouldAutoPlay) {
          console.log('🚀 Same track but auto-playing')
          audioRef.current.play().catch(err => {
            console.error('❌ Auto-play failed:', err)
            setIsLoading(false)
          })
          setShouldAutoPlay(false) // Reset flag
        }
      }
    }
  }, [currentTrack, minioPublicUrl, shouldAutoPlay, albumsData, volume])

  // Save volume to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('grup-yorum-volume', volume[0].toString())
      console.log('💾 Volume saved to localStorage:', volume[0])
    }
  }, [volume])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    
    const handleCanPlay = () => {
      if (audio.readyState >= 3) {
        setIsLoading(false)
      }
    }
    
    const handlePlaying = () => {
      console.log('▶️ Audio started playing')
      setIsPlaying(true)
      setIsLoading(false)
    }
    
    const handlePause = () => {
      console.log('⏸️ Audio paused')
      setIsPlaying(false)
      setIsLoading(false)
    }
    
    const handleEnded = () => {
      console.log('🔚 Audio ended')
      setIsPlaying(false)
      setIsLoading(false)
      setTrackEnded(true)
    }

    const handleError = (e: Event) => {
      console.error('❌ Audio error:', e)
      setIsLoading(false)
      setIsPlaying(false)
    }

    console.log('🎧 Setting up audio event listeners')
    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      console.log('🗑️ Cleaning up audio event listeners')
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [currentTrack, selectedAlbum])

  // Çalan albümü bul
  const getPlayingAlbum = () => {
    if (!currentTrack || !albumsData) return null
    return albumsData.albums.find(album => 
      album.tracks.some(track => track.file === currentTrack.file)
    )
  }

  const playingAlbum = getPlayingAlbum()

  const handleAlbumSelect = (album: Album) => {
    // Sadece UI'da gösterilen albümü değiştir, çalan şarkıyı durdurma
    setSelectedAlbum(album)
    console.log('🎵 Album selected for viewing:', album.title)
  }

  const handleTrackSelect = useCallback((track: Track, autoPlay: boolean = true) => {
    console.log('🎵 Track selected:', track.title, 'autoPlay:', autoPlay)
    console.log('🎵 Current track:', currentTrack?.title)
    
    // Aynı track'i tekrar seçme
    if (currentTrack?.file === track.file) {
      console.log('⏭️ Same track selected, ignoring')
      return
    }
    
    setCurrentTrack(track)
    
    // İlk defa bir şarkı seçiliyorsa, o şarkının albümünü göster
    if (!currentTrack && albumsData) {
      const trackAlbum = albumsData.albums.find(album => 
        album.tracks.some(t => t.file === track.file)
      )
      if (trackAlbum) {
        setSelectedAlbum(trackAlbum)
        console.log('🎵 Initial album set:', trackAlbum.title)
      }
    }
    
    if (autoPlay) {
      console.log('🚀 Setting shouldAutoPlay to true')
      setShouldAutoPlay(true)
    }
  }, [currentTrack, albumsData])

  // Player functions
  const playNextTrack = useCallback(() => {
    if (!playingAlbum || !currentTrack) return
    
    const currentIndex = playingAlbum.tracks.findIndex(t => t.file === currentTrack.file)
    if (currentIndex < playingAlbum.tracks.length - 1) {
      handleTrackSelect(playingAlbum.tracks[currentIndex + 1])
    }
  }, [playingAlbum, currentTrack, handleTrackSelect])

  const playPrevTrack = useCallback(() => {
    if (!playingAlbum || !currentTrack) return
    
    const currentIndex = playingAlbum.tracks.findIndex(t => t.file === currentTrack.file)
    if (currentIndex > 0) {
      handleTrackSelect(playingAlbum.tracks[currentIndex - 1])
    }
  }, [playingAlbum, currentTrack, handleTrackSelect])

  // Yeni fonksiyonlar: İlk veya son şarkıda mıyız kontrolü
  const isFirstTrack = useCallback(() => {
    if (!playingAlbum || !currentTrack) return false
    
    const currentIndex = playingAlbum.tracks.findIndex(t => t.file === currentTrack.file)
    return currentIndex === 0
  }, [playingAlbum, currentTrack])

  const isLastTrack = useCallback(() => {
    if (!playingAlbum || !currentTrack) return false
    
    const currentIndex = playingAlbum.tracks.findIndex(t => t.file === currentTrack.file)
    return currentIndex === playingAlbum.tracks.length - 1
  }, [playingAlbum, currentTrack])

  // Handle track ended
  useEffect(() => {
    if (trackEnded) {
      setTrackEnded(false) // Reset flag
      playNextTrack()
    }
  }, [trackEnded, playNextTrack])

  const togglePlayPause = () => {
    if (!audioRef.current || !currentTrack) return

    const audio = audioRef.current
    console.log('🎵 Toggle clicked, audio.paused:', audio.paused, 'audio.readyState:', audio.readyState)
    
    if (audio.paused) {
      console.log('▶️ Audio is paused, playing...')
      audio.play().catch(err => {
        console.error('❌ Play failed:', err)
        setIsLoading(false)
      })
    } else {
      console.log('⏸️ Audio is playing, pausing...')
      audio.pause()
    }
  }

  const handleProgressChange = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleVolumeChange = (value: number[]) => {
    console.log('🎛️ Volume slider changed to:', value[0])
    
    // Hemen audio volume'u güncelle
    if (audioRef.current) {
      const linearVolume = value[0] / 100
      const curvedVolume = Math.pow(linearVolume, 2)
      audioRef.current.volume = curvedVolume
      
      // Force unmute when user interacts with volume
      if (audioRef.current.muted) {
        audioRef.current.muted = false
        console.log('🔊 Force unmuted on volume change')
      }
      
      console.log(`🔊 Volume immediately set: ${value[0]}% -> ${(curvedVolume * 100).toFixed(1)}%`)
    }
    
    setVolume(value)
  }

  if (!albumsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Albümler yükleniyor...</h2>
        </div>
      </div>
    )
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <>
        <Head title="Grup Yorum - Halk Türküleri" />
        
        <div className="h-screen flex flex-col bg-background">
          {/* Header */}
          <header className="border-b p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Grup Yorum</h1>
                <p className="text-muted-foreground text-sm">Halk Türküleri</p>
              </div>
              
              <div className="flex items-center gap-2">
                {playingAlbum && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setSelectedAlbum(playingAlbum)
                      setMobileView('tracks')
                    }}
                    className="flex items-center gap-2"
                  >
                    <Music className="h-4 w-4" />
                    <span className="font-medium">Çalan Albüm</span>
                  </Button>
                )}
              </div>
            </div>
          </header>

          {/* Mobile Navigation */}
          <div className="border-b grid grid-cols-2 divide-x">
            <Button 
              variant={mobileView === 'albums' ? 'default' : 'ghost'}
              className="rounded-none h-12"
              onClick={() => setMobileView('albums')}
            >
              <Disc className="h-4 w-4 mr-2" />
              Albümler
            </Button>
            <Button 
              variant={mobileView === 'tracks' ? 'default' : 'ghost'}
              className="rounded-none h-12"
              onClick={() => {
                if (selectedAlbum) {
                  setMobileView('tracks')
                }
              }}
              disabled={!selectedAlbum}
            >
              <List className="h-4 w-4 mr-2" />
              Şarkılar
            </Button>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            {mobileView === 'albums' ? (
              <div className="p-4">
                <div className="grid gap-3">
                  {albumsData.albums.map((album) => (
                    <Card 
                      key={album.id}
                      className={`cursor-pointer transition-all hover:bg-accent ${
                        selectedAlbum?.id === album.id ? 'bg-accent border-primary' : ''
                      }`}
                      onClick={() => {
                        handleAlbumSelect(album)
                        setMobileView('tracks')
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 rounded-md">
                            <AvatarImage src={`${minioPublicUrl}/albums/${album.year}-${album.slug}/cover.jpg`} />
                            <AvatarFallback className="rounded-md">
                              {album.year}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{album.title}</h3>
                            <p className="text-xs text-muted-foreground">
                              {album.year} • {album.trackCount} şarkı
                            </p>
                          </div>
                          {/* Playing Indicator */}
                          {playingAlbum?.id === album.id && (
                            <div className="flex items-center">
                              {isPlaying ? (
                                <Music className="h-4 w-4 text-green-500 animate-pulse" />
                              ) : (
                                <Music className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : selectedAlbum ? (
              <div className="p-4">
                {/* Album Header */}
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-16 w-16 rounded-lg">
                    <AvatarImage src={`${minioPublicUrl}/albums/${selectedAlbum.year}-${selectedAlbum.slug}/cover.jpg`} />
                    <AvatarFallback className="rounded-lg text-lg">
                      {selectedAlbum.year}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">{selectedAlbum.title}</h2>
                    <p className="text-muted-foreground text-sm">
                      {selectedAlbum.year} • {selectedAlbum.trackCount} şarkı
                    </p>
                  </div>
                </div>

                {/* Track List */}
                <div className="space-y-1 px-2">
                  {selectedAlbum.tracks.map((track) => (
                    <div
                      key={`${track.disc || 1}-${track.track}`}
                      className={`flex items-center gap-3 p-3 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                        currentTrack?.file === track.file ? 'bg-accent' : ''
                      }`}
                      onClick={() => handleTrackSelect(track)}
                    >
                      <div className="w-8 text-center">
                        {currentTrack?.file === track.file && isPlaying ? (
                          <div className="w-4 h-4 bg-primary rounded-full mx-auto animate-pulse" />
                        ) : currentTrack?.file === track.file && isLoading ? (
                          <Loader2 className="w-4 h-4 mx-auto animate-spin" />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {track.track}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{track.title}</p>
                        {track.disc && (
                          <p className="text-xs text-muted-foreground">CD {track.disc}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Bir albüm seçin</p>
              </div>
            )}
          </div>

          {/* Player Bar */}
          <footer className="border-t bg-card p-4">
            {/* Audio Element */}
            <audio ref={audioRef} preload="metadata" />
            
            <div className="flex flex-col gap-3">
              {/* Currently Playing */}
              <div className="flex items-center gap-3">
                {currentTrack && playingAlbum ? (
                  <>
                    <Avatar className="h-12 w-12 rounded-md">
                      <AvatarImage src={`${minioPublicUrl}/albums/${playingAlbum.year}-${playingAlbum.slug}/cover.jpg`} />
                      <AvatarFallback className="rounded-md">♪</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{currentTrack.title}</p>
                      <p className="text-xs text-muted-foreground">Grup Yorum</p>
                      
                      {/* Progress Bar moved here */}
                      {currentTrack && (
                        <div className="flex items-center gap-1 w-full mt-1">
                          <span className="text-xs text-muted-foreground w-7 text-right">
                            {formatTime(currentTime)}
                          </span>
                          <Slider
                            value={[currentTime]}
                            onValueChange={handleProgressChange}
                            max={duration || 100}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-xs text-muted-foreground w-7">
                            {formatTime(duration)}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground">♪</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Şarkı seçin</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={playPrevTrack} disabled={isFirstTrack()}>
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button size="icon" onClick={togglePlayPause} disabled={!currentTrack}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={playNextTrack} disabled={isLastTrack()}>
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </>
    )
  }

  // Desktop Layout (unchanged)
  return (
    <>
      <Head title="Grup Yorum - Halk Türküleri" />
      
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">Grup Yorum</h1>
                <p className="text-muted-foreground">Halk Türküleri</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Back to Playing Album Button - moved to right side */}
              {playingAlbum && selectedAlbum?.id !== playingAlbum.id && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedAlbum(playingAlbum)}
                  className="flex items-center gap-2 mr-3"
                >
                  <Music className="h-4 w-4" />
                  <span className="hidden sm:inline">Çalan Albüm:</span>
                  <span className="font-medium">{playingAlbum.title}</span>
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                {albumsData.totalAlbums} Albüm • {albumsData.albums.reduce((acc, album) => acc + album.trackCount, 0)} Şarkı
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Albums Panel */}
            <ResizablePanel defaultSize={35} minSize={25}>
              <div className="h-full p-4">
                <h2 className="text-lg font-semibold mb-4">Albümler</h2>
                <ScrollArea className="h-[calc(100vh-16rem)]">
                  <div className="grid gap-3 px-4">
                    {albumsData.albums.map((album) => (
                      <Card 
                        key={album.id}
                        className={`cursor-pointer transition-all hover:bg-accent ${
                          selectedAlbum?.id === album.id ? 'bg-accent border-primary' : ''
                        }`}
                        onClick={() => handleAlbumSelect(album)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 rounded-md">
                              <AvatarImage src={`${minioPublicUrl}/albums/${album.year}-${album.slug}/cover.jpg`} />
                              <AvatarFallback className="rounded-md">
                                {album.year}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm truncate">{album.title}</h3>
                              <p className="text-xs text-muted-foreground">
                                {album.year} • {album.trackCount} şarkı
                              </p>
                            </div>
                            {/* Playing Indicator */}
                            {playingAlbum?.id === album.id && (
                              <div className="flex items-center">
                                {isPlaying ? (
                                  <Music className="h-4 w-4 text-green-500 animate-pulse" />
                                ) : (
                                  <Music className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Tracks Panel */}
            <ResizablePanel defaultSize={65}>
              <div className="h-full p-4">
                {selectedAlbum ? (
                  <>
                    {/* Album Header */}
                    <div className="flex items-start gap-4 mb-6">
                      <Avatar className="h-20 w-20 rounded-lg">
                        <AvatarImage src={`${minioPublicUrl}/albums/${selectedAlbum.year}-${selectedAlbum.slug}/cover.jpg`} />
                        <AvatarFallback className="rounded-lg text-lg">
                          {selectedAlbum.year}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="text-2xl font-bold">{selectedAlbum.title}</h2>
                        <p className="text-muted-foreground">
                          {selectedAlbum.year} • {selectedAlbum.trackCount} şarkı
                        </p>
                        {selectedAlbum.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedAlbum.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Track List */}
                    <ScrollArea className="h-[calc(100vh-20rem)]">
                      <div className="space-y-1 px-4">
                        {selectedAlbum.tracks.map((track) => (
                          <div
                            key={`${track.disc || 1}-${track.track}`}
                            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                              currentTrack?.file === track.file ? 'bg-accent' : ''
                            }`}
                            onClick={() => handleTrackSelect(track)}
                          >
                            <div className="w-8 text-center">
                              {currentTrack?.file === track.file && isPlaying ? (
                                <div className="w-4 h-4 bg-primary rounded-full mx-auto animate-pulse" />
                              ) : currentTrack?.file === track.file && isLoading ? (
                                <Loader2 className="w-4 h-4 mx-auto animate-spin" />
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {track.track}
                                </span>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{track.title}</p>
                              {track.disc && (
                                <p className="text-xs text-muted-foreground">CD {track.disc}</p>
                              )}
                            </div>
                            <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100">
                              <Heart className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Bir albüm seçin</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Player Bar */}
        <footer className="border-t bg-card p-4">
          {/* Audio Element */}
          <audio ref={audioRef} preload="metadata" />
          
          <div className="flex items-center justify-between">
            {/* Currently Playing */}
            <div className="flex items-center gap-3 flex-1">
              {currentTrack && playingAlbum ? (
                <>
                  <Avatar className="h-12 w-12 rounded-md">
                    <AvatarImage src={`${minioPublicUrl}/albums/${playingAlbum.year}-${playingAlbum.slug}/cover.jpg`} />
                    <AvatarFallback className="rounded-md">♪</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{currentTrack.title}</p>
                    <p className="text-xs text-muted-foreground">Grup Yorum</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground">♪</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Şarkı seçin</p>
                  </div>
                </div>
              )}
            </div>

            {/* Player Controls & Progress */}
            <div className="flex flex-col items-center flex-1">
              {/* Controls */}
              <div className="flex items-center gap-2 mb-2">
                <Button size="sm" variant="ghost" onClick={playPrevTrack} disabled={isFirstTrack()}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={togglePlayPause} disabled={!currentTrack}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={playNextTrack} disabled={isLastTrack()}>
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress Bar - only for desktop */}
              {currentTrack && (
                <div className="flex items-center gap-2 w-full max-w-md">
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {formatTime(currentTime)}
                  </span>
                  <Slider
                    value={[currentTime]}
                    onValueChange={handleProgressChange}
                    max={duration || 100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-10">
                    {formatTime(duration)}
                  </span>
                </div>
              )}
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <Volume2 className="h-4 w-4" />
              <Slider
                value={volume}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="w-24"
              />
            </div>
          </div>
        </footer>
      </div>
    </>
  )
} 