import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Head } from '@inertiajs/react'
import { Card, CardContent } from '@/components/ui/card'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Loader2, Music, List, Disc } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import ProgressBar from '@/components/app/ProgressBar'
import PlayerControls from '@/components/app/PlayerControls'
import VolumeControl from '@/components/app/VolumeControl'
import CurrentTrackInfo from '@/components/app/CurrentTrackInfo'
import PlayerBar from '@/components/app/PlayerBar'
import AlbumDetailHeader from '@/components/app/AlbumDetailHeader'
import TrackList from '@/components/app/TrackList'
import AlbumList from '@/components/app/AlbumList'
import MobileNavigation from '@/components/app/MobileNavigation'
import MobileHeader from '@/components/app/MobileHeader'
import DesktopHeader from '@/components/app/DesktopHeader'

export interface Track {
  track: number
  title: string
  file: string
  disc?: number
}

export interface Album {
  id: number
  title: string
  year: number
  slug: string
  cover: string
  trackCount: number
  tracks: Track[]
  description?: string
}

export interface AlbumsData {
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
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('grup-yorum-volume')
      return savedVolume ? [parseInt(savedVolume)] : [75]
    }
    return [75]
  })
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
        if (data.albums.length > 0) {
          const firstAlbum = data.albums[0]
          setSelectedAlbum(firstAlbum)
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
      const trackAlbum = albumsData.albums.find(album => 
        album.tracks.some(track => track.file === currentTrack.file)
      )
      if (!trackAlbum) return
      const trackUrl = `${minioPublicUrl}/albums/${trackAlbum.year}-${trackAlbum.slug}/tracks/${currentTrack.file}`
      console.log('🔗 Current audio src:', audioRef.current.src)
      console.log('🔗 New track URL:', trackUrl)
      console.log('🔗 shouldAutoPlay:', shouldAutoPlay)
      const currentSrc = audioRef.current.src
      const isSameTrack = currentSrc === trackUrl
      if (!isSameTrack) {
        console.log('✅ Setting new audio URL')
        audioRef.current.src = trackUrl
        const linearVolume = volume[0] / 100
        const curvedVolume = Math.pow(linearVolume, 2)
        audioRef.current.volume = curvedVolume
        audioRef.current.muted = false
        console.log(`🔊 Volume set with URL: ${volume[0]}% -> ${(curvedVolume * 100).toFixed(1)}%`)
        if (shouldAutoPlay) {
          console.log('🚀 Auto-playing new track')
          audioRef.current.play().catch(err => {
            console.error('❌ Auto-play failed:', err)
            setIsLoading(false)
          })
          setShouldAutoPlay(false) 
        }
      } else {
        console.log('⏭️ Same track URL, skipping')
        if (shouldAutoPlay) {
          console.log('🚀 Same track but auto-playing')
          audioRef.current.play().catch(err => {
            console.error('❌ Auto-play failed:', err)
            setIsLoading(false)
          })
          setShouldAutoPlay(false) 
        }
      }
    }
  }, [currentTrack, minioPublicUrl, shouldAutoPlay, albumsData, volume, setIsLoading])

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

    const handleCanPlay = () => { if (audio.readyState >= 3) setIsLoading(false) }
    const handlePlaying = () => { console.log('▶️ Audio started playing'); setIsPlaying(true); setIsLoading(false) }
    const handlePause = () => { console.log('⏸️ Audio paused'); setIsPlaying(false); setIsLoading(false) }
    const handleEnded = () => { console.log('🔚 Audio ended'); setIsPlaying(false); setIsLoading(false); setTrackEnded(true) }
    const handleError = (e: Event) => { console.error('❌ Audio error:', e); setIsLoading(false); setIsPlaying(false) }

    console.log('🎧 Setting up audio event listeners in Index.tsx')
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      console.log('🗑️ Cleaning up audio event listeners in Index.tsx')
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [currentTrack, audioRef, setIsLoading, setIsPlaying, setTrackEnded])

  const getPlayingAlbum = useCallback(() => {
    if (!currentTrack || !albumsData) return null
    return albumsData.albums.find(album => 
      album.tracks.some(track => track.file === currentTrack.file)
    )
  }, [currentTrack, albumsData])

  const playingAlbum = useMemo(() => getPlayingAlbum(), [getPlayingAlbum])

  const handleAlbumSelect = useCallback((album: Album) => {
    setSelectedAlbum(album)
    console.log('🎵 Album selected for viewing:', album.title)
  }, [setSelectedAlbum])

  const handleTrackSelect = useCallback((track: Track, autoPlay: boolean = true) => {
    console.log('🎵 Track selected:', track.title, 'autoPlay:', autoPlay)
    console.log('🎵 Current track:', currentTrack?.title)
    if (currentTrack?.file === track.file) {
      console.log('⏭️ Same track selected, ignoring')
      return
    }
    setCurrentTrack(track)
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
  }, [currentTrack, albumsData, setCurrentTrack, setSelectedAlbum, setShouldAutoPlay])

  const playNextTrack = useCallback(() => {
    const album = playingAlbum
    if (!album || !currentTrack) return
    const currentIndex = album.tracks.findIndex(t => t.file === currentTrack.file)
    if (currentIndex < album.tracks.length - 1) {
      handleTrackSelect(album.tracks[currentIndex + 1])
    }
  }, [playingAlbum, currentTrack, handleTrackSelect])

  const playPrevTrack = useCallback(() => {
    const album = playingAlbum
    if (!album || !currentTrack) return
    const currentIndex = album.tracks.findIndex(t => t.file === currentTrack.file)
    if (currentIndex > 0) {
      handleTrackSelect(album.tracks[currentIndex - 1])
    }
  }, [playingAlbum, currentTrack, handleTrackSelect])

  const isFirstTrack = useCallback(() => {
    const album = playingAlbum
    if (!album || !currentTrack) return false
    return album.tracks.findIndex(t => t.file === currentTrack.file) === 0
  }, [playingAlbum, currentTrack])

  const isLastTrack = useCallback(() => {
    const album = playingAlbum
    if (!album || !currentTrack) return false
    return album.tracks.findIndex(t => t.file === currentTrack.file) === album.tracks.length - 1
  }, [playingAlbum, currentTrack])

  useEffect(() => {
    if (trackEnded) {
      setTrackEnded(false) 
      playNextTrack() 
    }
  }, [trackEnded, playNextTrack, setTrackEnded])

  const togglePlayPause = useCallback(() => {
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
  }, [currentTrack, setIsLoading, audioRef])

  const handleProgressChange = useCallback((value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
    }
  }, [audioRef])

  const handleVolumeChange = useCallback((value: number[]) => {
    console.log('🎛️ Volume slider changed to:', value[0])
    if (audioRef.current) {
      const linearVolume = value[0] / 100
      const curvedVolume = Math.pow(linearVolume, 2)
      audioRef.current.volume = curvedVolume
      if (audioRef.current.muted) {
        audioRef.current.muted = false
        console.log('🔊 Force unmuted on volume change')
      }
      console.log(`🔊 Volume immediately set: ${value[0]}% -> ${(curvedVolume * 100).toFixed(1)}%`)
    }
    setVolume(value)
  }, [setVolume, audioRef])

  const goToPlayingAlbumMobile = useCallback(() => {
    if (playingAlbum) {
      setSelectedAlbum(playingAlbum)
      setMobileView('tracks')
    }
  }, [playingAlbum, setSelectedAlbum, setMobileView])

  const onAlbumSelectMobileCallback = useCallback(() => setMobileView('tracks'), [setMobileView])

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
          <MobileHeader 
            playingAlbum={playingAlbum || null}
            onGoToPlayingAlbum={goToPlayingAlbumMobile}
          />

          {/* Mobile Navigation */}
          <MobileNavigation 
            mobileView={mobileView}
            onSetMobileView={setMobileView}
            hasSelectedAlbum={!!selectedAlbum} 
          />

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            {mobileView === 'albums' ? (
              <div className="p-4">
                <AlbumList 
                  albums={albumsData.albums}
                  selectedAlbumId={selectedAlbum?.id || null}
                  playingAlbumId={playingAlbum?.id || null}
                  isPlaying={isPlaying}
                  minioPublicUrl={minioPublicUrl}
                  onAlbumSelect={handleAlbumSelect}
                  onAlbumSelectMobile={onAlbumSelectMobileCallback}
                  isMobile={true}
                />
              </div>
            ) : selectedAlbum ? (
              <div className="p-4">
                {/* Album Header */}
                <AlbumDetailHeader 
                  selectedAlbum={selectedAlbum} 
                  minioPublicUrl={minioPublicUrl} 
                  isMobile={true} 
                />

                {/* Track List */}
                <TrackList 
                  tracks={selectedAlbum.tracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  isLoading={isLoading}
                  onTrackSelect={handleTrackSelect}
                  className="px-2"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Bir albüm seçin</p>
              </div>
            )}
          </div>

          {/* Player Bar */}
          <PlayerBar 
            audioRef={audioRef}
            minioPublicUrl={minioPublicUrl}
            currentTrack={currentTrack}
            playingAlbum={playingAlbum || null}
            onProgressChange={handleProgressChange}
            togglePlayPause={togglePlayPause}
            playNextTrack={playNextTrack}
            playPrevTrack={playPrevTrack}
            isPlaying={isPlaying}
            isLoading={isLoading}
            isFirstTrack={isFirstTrack()}
            isLastTrack={isLastTrack()}
            hasCurrentTrack={!!currentTrack}
            volume={volume}
            handleVolumeChange={handleVolumeChange}
            isMobile={true}
          />
        </div>
      </>
    )
  }

  // Desktop Layout
  return (
    <>
      <Head title="Grup Yorum - Halk Türküleri" />
      
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        {albumsData && (
            <DesktopHeader 
                albumsData={albumsData}
                selectedAlbum={selectedAlbum}
                playingAlbum={playingAlbum || null}
                onSetSelectedAlbum={handleAlbumSelect}
            />
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Albums Panel */}
            <ResizablePanel defaultSize={35} minSize={25}>
              <div className="h-full p-4">
                <h2 className="text-lg font-semibold mb-4">Albümler</h2>
                <ScrollArea className="h-[calc(100vh-16rem)]">
                  <AlbumList 
                    albums={albumsData.albums}
                    selectedAlbumId={selectedAlbum?.id || null}
                    playingAlbumId={playingAlbum?.id || null}
                    isPlaying={isPlaying}
                    minioPublicUrl={minioPublicUrl}
                    onAlbumSelect={handleAlbumSelect}
                  />
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
                    <AlbumDetailHeader 
                      selectedAlbum={selectedAlbum} 
                      minioPublicUrl={minioPublicUrl} 
                    />

                    {/* Track List */}
                    <ScrollArea className="h-[calc(100vh-20rem)]">
                      <TrackList 
                        tracks={selectedAlbum.tracks}
                        currentTrack={currentTrack}
                        isPlaying={isPlaying}
                        isLoading={isLoading}
                        onTrackSelect={handleTrackSelect}
                        className="px-4"
                      />
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
        <PlayerBar 
          audioRef={audioRef}
          minioPublicUrl={minioPublicUrl}
          currentTrack={currentTrack}
          playingAlbum={playingAlbum || null}
          onProgressChange={handleProgressChange}
          togglePlayPause={togglePlayPause}
          playNextTrack={playNextTrack}
          playPrevTrack={playPrevTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          isFirstTrack={isFirstTrack()}
          isLastTrack={isLastTrack()}
          hasCurrentTrack={!!currentTrack}
          volume={volume}
          handleVolumeChange={handleVolumeChange}
          isMobile={false}
        />
      </div>
    </>
  )
} 