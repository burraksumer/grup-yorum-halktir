import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import { Head } from '@inertiajs/react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIsMobile } from '@/hooks/use-mobile'
import PlayerBar from '@/components/app/PlayerBar'
import AlbumDetailHeader from '@/components/app/AlbumDetailHeader'
import TrackList from '@/components/app/TrackList'
import AlbumList from '@/components/app/AlbumList'
import MobileNavigation from '@/components/app/MobileNavigation'
import MobileHeader from '@/components/app/MobileHeader'
import DesktopHeader from '@/components/app/DesktopHeader'
import { usePlayerStore, Album, Track /*, AlbumsData*/ } from '@/store/playerStore'

interface PageProps {
  minioPublicUrl: string
}

export default function Index({ minioPublicUrl }: PageProps) {
  // Zustand store selectors
  const albumsData = usePlayerStore(state => state.albumsData);
  const selectedAlbum = usePlayerStore(state => state.selectedAlbum);
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const isLoading = usePlayerStore(state => state.isLoading);
  const volume = usePlayerStore(state => state.volume);
  const mobileView = usePlayerStore(state => state.mobileView);
  const shouldAutoPlay = usePlayerStore(state => state.shouldAutoPlay);
  const _hasHydrated = usePlayerStore(state => state._hasHydrated);
  const setDurationStore = usePlayerStore(state => state.setDuration);

  // Zustand store actions
  const fetchAlbumsAndSetInitialTrackStore = usePlayerStore(state => state.fetchAlbumsAndSetInitialTrack);
  const setVolumeStore = usePlayerStore(state => state.setVolume);
  const setMobileViewStore = usePlayerStore(state => state.setMobileView);
  const setSelectedAlbumStore = usePlayerStore(state => state.setSelectedAlbum);
  const setCurrentTrackStore = usePlayerStore(state => state.setCurrentTrack);
  const togglePlayStore = usePlayerStore(state => state.togglePlay);
  const setIsLoadingStore = usePlayerStore(state => state.setIsLoading);
  const setIsPlayingStore = usePlayerStore(state => state.setIsPlaying);
  const playNextTrackStore = usePlayerStore(state => state.playNextTrack);
  const playPrevTrackStore = usePlayerStore(state => state.playPrevTrack);
  const handleProgressChangeStoreAction = usePlayerStore(state => state.handleProgressChange);
  const setJustRehydratedStore = usePlayerStore(state => state.setJustRehydrated);

  const isMobile = useIsMobile()
  const audioRef = useRef<HTMLAudioElement>(null)

  // Load albums metadata - Now handled by Zustand action
  useEffect(() => {
    fetchAlbumsAndSetInitialTrackStore();
  }, [fetchAlbumsAndSetInitialTrackStore]);

  // Effect 1: Handles setting the audio source, volume, and initial play for new tracks
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const linearVolume = volume[0] / 100;
    const curvedVolume = Math.pow(linearVolume, 2);
    audio.volume = curvedVolume;

    if (currentTrack && albumsData) {
      const trackAlbum = albumsData.albums.find(album => 
        album.tracks.some(track => track.file === currentTrack.file)
      );
      if (!trackAlbum) {
        console.error('❌ Audio Effect: Could not find album for current track', currentTrack.title);
        return;
      }

      const newTrackUrl = `${minioPublicUrl}/albums/${trackAlbum.year}-${trackAlbum.slug}/tracks/${currentTrack.file}`;
      const decodedCurrentAudioSrc = audio.src ? decodeURIComponent(audio.src) : "";
      
      if (decodedCurrentAudioSrc !== newTrackUrl) {
        audio.src = newTrackUrl;
        setIsLoadingStore(true); 
        audio.load(); 
      } else {
        setIsLoadingStore(false); 
      }
    } else if (!currentTrack) {
      audio.src = '';
      if (!audio.paused) audio.pause();
      setIsLoadingStore(false); 
      setIsPlayingStore(false); 
    }
  }, [currentTrack, volume, minioPublicUrl, albumsData, setIsLoadingStore, setIsPlayingStore, shouldAutoPlay]);


  // Effect 2: Handles play/pause control based on isPlaying state from store
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    if (isPlaying && currentTrack && audio.src) {
      if (audio.paused) {
        audio.play().catch(err => {
          console.error('❌ Audio Effect: Play failed', err);
          setIsPlayingStore(false);
          setIsLoadingStore(false);
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, currentTrack, setIsLoadingStore, setIsPlayingStore]);


  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleCanPlay = () => { 
      const store = usePlayerStore.getState();
      
      if (store.justRehydrated && store.currentTrack && audioRef.current?.currentTime && Math.abs(audioRef.current.currentTime - store.currentTime) < 0.5) {
        setIsLoadingStore(false);
        setJustRehydratedStore(false);
        usePlayerStore.getState().setHasHydrated(true);
        
        if (store.shouldAutoPlay && !store.isPlaying) {
            if (audioRef.current && audioRef.current.src) {
                audioRef.current.play().catch(e => {
                    console.error("[CanPlay] Rehydrated Auto-play failed", e);
                    setIsLoadingStore(false);
                    setIsPlayingStore(false);
                });
            }
        }
      } else if (store.isLoading) {
        if (!store.shouldAutoPlay && !store.isPlaying) {
          setIsLoadingStore(false);
        } else if (store.shouldAutoPlay && !store.isPlaying) {
            if (audioRef.current && audioRef.current.src) {
                audioRef.current.play().catch(e => {
                    console.error("❌ Audio Event (CanPlay): Auto-play failed", e);
                    setIsLoadingStore(false);
                    setIsPlayingStore(false);
                });
            } else {
                 setIsLoadingStore(false); 
            }
        }
      }
    }
    const handlePlaying = () => { 
      const store = usePlayerStore.getState();
      if (store.justRehydrated) {
        setJustRehydratedStore(false);
        usePlayerStore.getState().setHasHydrated(true);
      }
      setIsPlayingStore(true); 
      setIsLoadingStore(false); 
    }
    const handlePause = () => { 
      setIsPlayingStore(false); 
    }
    const handleEnded = () => { 
      setIsPlayingStore(false); 
      usePlayerStore.getState().playNextTrack();
    }
    const handleError = () => {
      setIsLoadingStore(false); 
      setIsPlayingStore(false); 
    }
    const handleLoadStart = () => {
    }
    const handleWaiting = () => {
      setIsLoadingStore(true);
    }
    const handleStalled = () => {
      setIsLoadingStore(true);
    }
    const handleLoadedMetadata = () => {
      const store = usePlayerStore.getState();

      if (audioRef.current) {
        setDurationStore(audioRef.current.duration);
        
        if (store.justRehydrated && store.currentTrack && store.currentTime > 0) {
          const trackAlbum = store.albumsData?.albums.find(album => 
            album.tracks.some(track => track.file === store.currentTrack!.file)
          );
          if (trackAlbum) {
            const expectedSrcSuffix = `/albums/${trackAlbum.year}-${trackAlbum.slug}/tracks/${store.currentTrack!.file}`;
            const currentAudioSrc = audioRef.current.src ? decodeURIComponent(audioRef.current.src) : "";

            if (currentAudioSrc.endsWith(expectedSrcSuffix)) {
              audioRef.current.currentTime = store.currentTime;
              setIsLoadingStore(true);
            } else {
              setIsLoadingStore(false); 
              setJustRehydratedStore(false); 
              usePlayerStore.getState().setHasHydrated(true);
            }
          } else {
            setIsLoadingStore(false); 
            setJustRehydratedStore(false); 
            usePlayerStore.getState().setHasHydrated(true);
          }
        } else if (store.justRehydrated) {
          setIsLoadingStore(false); 
          setJustRehydratedStore(false);
          usePlayerStore.getState().setHasHydrated(true);
        }
      }
    }

    audio.addEventListener('canplaythrough', handleCanPlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('loadstart', handleLoadStart); 
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('canplaythrough', handleCanPlay)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }, [audioRef, setIsLoadingStore, setIsPlayingStore, currentTrack, setDurationStore, setJustRehydratedStore, albumsData, minioPublicUrl]);

  const getPlayingAlbum = useCallback(() => {
    if (!currentTrack || !albumsData) return null
    return albumsData.albums.find(album => 
      album.tracks.some(track => track.file === currentTrack.file)
    )
  }, [currentTrack, albumsData])

  const playingAlbum = useMemo(() => getPlayingAlbum(), [getPlayingAlbum])

  const handleAlbumSelect = useCallback((album: Album) => {
    setSelectedAlbumStore(album);
  }, [setSelectedAlbumStore]);

  const handleTrackSelect = useCallback((track: Track, autoPlay: boolean = true) => {
    setCurrentTrackStore(track, autoPlay);
  }, [setCurrentTrackStore]);

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

  const togglePlayPause = useCallback(() => {
    togglePlayStore();
  }, [togglePlayStore])

  const handleProgressChange = useCallback((value: number[]) => {
    const newTime = value[0];
    if (audioRef.current) {
      audioRef.current.currentTime = newTime; 
    }
    handleProgressChangeStoreAction(newTime);
  }, [audioRef, handleProgressChangeStoreAction]);

  const handleVolumeChange = useCallback((value: number[]) => {
    setVolumeStore(value);
    if (audioRef.current) {
      const linearVolume = value[0] / 100
      const curvedVolume = Math.pow(linearVolume, 2)
      audioRef.current.volume = curvedVolume
      if (audioRef.current.muted) {
        audioRef.current.muted = false
      }
    }
  }, [setVolumeStore, audioRef])

  const goToPlayingAlbumMobile = useCallback(() => {
    if (playingAlbum) {
      if (usePlayerStore.getState().selectedAlbum?.id !== playingAlbum.id) {
        setSelectedAlbumStore(playingAlbum);
      }
      setMobileViewStore('tracks')
    }
  }, [playingAlbum, setSelectedAlbumStore, setMobileViewStore])

  const onAlbumSelectMobileCallback = useCallback(() => setMobileViewStore('tracks'), [setMobileViewStore])

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
            onSetMobileView={setMobileViewStore}
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
            playNextTrack={playNextTrackStore}
            playPrevTrack={playPrevTrackStore}
            isPlaying={isPlaying}
            isLoading={!_hasHydrated || isLoading}
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
                onSetSelectedAlbum={setSelectedAlbumStore}
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
          playNextTrack={playNextTrackStore}
          playPrevTrack={playPrevTrackStore}
          isPlaying={isPlaying}
          isLoading={!_hasHydrated || isLoading}
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