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
import { usePlayerStore, Album, Track, AlbumsData } from '@/store/playerStore';

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
  const storeCurrentTime = usePlayerStore(state => state.currentTime); // For restoring currentTime
  const justRehydrated = usePlayerStore(state => state.justRehydrated); // For restoring currentTime
  const _hasHydrated = usePlayerStore(state => state._hasHydrated); // For initial loading UI
  const setDurationStore = usePlayerStore(state => state.setDuration); // To store track duration

  // Zustand store actions
  const fetchAlbumsAndSetInitialTrackStore = usePlayerStore(state => state.fetchAlbumsAndSetInitialTrack);
  const setVolumeStore = usePlayerStore(state => state.setVolume);
  const setMobileViewStore = usePlayerStore(state => state.setMobileView);
  const setSelectedAlbumStore = usePlayerStore(state => state.setSelectedAlbum);
  const setCurrentTrackStore = usePlayerStore(state => state.setCurrentTrack);
  const togglePlayStore = usePlayerStore(state => state.togglePlay);
  const setIsLoadingStore = usePlayerStore(state => state.setIsLoading);
  const setIsPlayingStore = usePlayerStore(state => state.setIsPlaying);
  const setShouldAutoPlayStore = usePlayerStore(state => state.setShouldAutoPlay);
  const playNextTrackStore = usePlayerStore(state => state.playNextTrack);
  const playPrevTrackStore = usePlayerStore(state => state.playPrevTrack);
  const setCurrentTimeStore = usePlayerStore(state => state.setCurrentTime);
  const handleProgressChangeStoreAction = usePlayerStore(state => state.handleProgressChange);
  const setJustRehydratedStore = usePlayerStore(state => state.setJustRehydrated); // Action for the flag

  const isMobile = useIsMobile()
  const audioRef = useRef<HTMLAudioElement>(null)

  // Load albums metadata - Now handled by Zustand action
  useEffect(() => {
    fetchAlbumsAndSetInitialTrackStore(); // minioPublicUrl removed from store action
  }, [fetchAlbumsAndSetInitialTrackStore]);

  // Effect 1: Handles setting the audio source, volume, and initial play for new tracks
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const linearVolume = volume[0] / 100;
    const curvedVolume = Math.pow(linearVolume, 2);
    audio.volume = curvedVolume;
    console.log(`🔊 Audio Effect (Volume): Set to ${volume[0]}% -> ${(curvedVolume * 100).toFixed(1)}%`);

    if (currentTrack && albumsData) {
      console.log('[Effect 1] CurrentTrack and AlbumsData available:', currentTrack.title, 'Albums count:', albumsData.albums.length);
      const trackAlbum = albumsData.albums.find(album => 
        album.tracks.some(track => track.file === currentTrack.file)
      );
      if (!trackAlbum) {
        console.error('❌ Audio Effect: Could not find album for current track', currentTrack.title);
        return;
      }

      const newTrackUrl = `${minioPublicUrl}/albums/${trackAlbum.year}-${trackAlbum.slug}/tracks/${currentTrack.file}`;
      const decodedCurrentAudioSrc = audio.src ? decodeURIComponent(audio.src) : "";
      
      console.log('[Effect 1] Checking src: Current decoded src:', decodedCurrentAudioSrc, 'New URL:', newTrackUrl);

      // If the decoded current src is different from the new desired URL, update it.
      if (decodedCurrentAudioSrc !== newTrackUrl) {
        console.log(`✅ Audio Effect: Setting new src: ${newTrackUrl}`);
        audio.src = newTrackUrl;
        setIsLoadingStore(true); 
        audio.load(); 
        console.log('✅ Audio Effect: audio.load() called.');
        
        // Log network state shortly after load() to see if it starts loading
        setTimeout(() => {
          if (audioRef.current) { // Check if ref is still valid
            console.log(`[Effect 1 - Post Load] networkState: ${audioRef.current.networkState}, readyState: ${audioRef.current.readyState}, error: ${audioRef.current.error?.message}`);
            switch (audioRef.current.networkState) {
              case HTMLMediaElement.NETWORK_EMPTY: console.log('[Effect 1 - Post Load] Network State: NETWORK_EMPTY (0)'); break;
              case HTMLMediaElement.NETWORK_IDLE: console.log('[Effect 1 - Post Load] Network State: NETWORK_IDLE (1)'); break;
              case HTMLMediaElement.NETWORK_LOADING: console.log('[Effect 1 - Post Load] Network State: NETWORK_LOADING (2) - SHOULD BE THIS!'); break;
              case HTMLMediaElement.NETWORK_NO_SOURCE: console.log('[Effect 1 - Post Load] Network State: NETWORK_NO_SOURCE (3)'); break;
              default: console.log('[Effect 1 - Post Load] Network State: Unknown');
            }
          }
        }, 100); // 100ms delay

        // shouldAutoPlay logic is for when setCurrentTrack is called with autoPlay=true
        // For rehydration, shouldAutoPlay is false, so this block won't run for auto-play.
        if (shouldAutoPlay) {
          console.log('🚀 Audio Effect: New track source set, shouldAutoPlay is true. isPlaying will trigger play if store indicates.');
          // The play/pause effect (Effect 2) will handle actual play() if isPlaying is true in store.
          // setCurrentTrack (if called with autoPlay=true) sets isPlaying to false and isLoading to true initially.
          // The 'canplay' or 'playing' event will then set isPlaying true / isLoading false.
        }
      } else {
        console.log('[Effect 1] Src is already correct. No change to audio.src needed.');
        // If src is already correct (e.g. rehydrated track, Effect 1 runs after Effect for currentTime restoration attempted it)
        // ensure isLoading is false if we are not supposed to be auto-playing and not already playing.
        // This handles the case where the rehydrated track is loaded, but play hasn't been pressed.
        // The loadedmetadata event handler is now primarily responsible for isLoading=false for rehydrated tracks.
      }
    } else if (!currentTrack) {
      console.log('🔇 Audio Effect: No current track. Clearing src and pausing.');
      audio.src = '';
      if (!audio.paused) audio.pause();
      setIsLoadingStore(false); 
      setIsPlayingStore(false); 
    } else if (!albumsData && currentTrack) {
      console.log('[Effect 1] CurrentTrack available, but AlbumsData is not yet. Waiting for AlbumsData to set src.');
    }
  }, [currentTrack, volume, minioPublicUrl, albumsData, setIsLoadingStore, setIsPlayingStore, shouldAutoPlay]);


  // Effect 2: Handles play/pause control based on isPlaying state from store
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    console.log(`⏯️ Audio Effect (Play/Pause): isPlaying=${isPlaying}, CT=${currentTrack?.title}`);

    if (isPlaying && currentTrack && audio.src) { // audio.src check to ensure it's loaded
      if (audio.paused) {
        console.log('▶️ Audio Effect: isPlaying is true & audio paused. Calling play()');
        // setIsLoadingStore(true); // Loading is handled by togglePlay or track change
        audio.play().catch(err => {
          console.error('❌ Audio Effect: Play failed', err);
          setIsPlayingStore(false); // Update store if play fails
          setIsLoadingStore(false);
        });
      } else {
        // console.log('✅ Audio Effect: isPlaying is true & audio already playing.');
      }
    } else {
      if (!audio.paused) {
        console.log('⏸️ Audio Effect: isPlaying is false or no track/src. Calling pause()');
        audio.pause();
      } else {
        // console.log('✅ Audio Effect: isPlaying is false & audio already paused.');
      }
    }
  }, [isPlaying, currentTrack, setIsLoadingStore, setIsPlayingStore]); // Depends on isPlaying and currentTrack


  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleCanPlay = () => { 
      console.log('✅ Audio can play through.');
      const store = usePlayerStore.getState();
      
      // Check if this is canplay after a rehydrated seek
      if (store.justRehydrated && store.currentTrack && audioRef.current?.currentTime && Math.abs(audioRef.current.currentTime - store.currentTime) < 0.5) {
        console.log('[CanPlay] Rehydrated track is now playable at seeked time. Setting flags.');
        setIsLoadingStore(false);
        setJustRehydratedStore(false);
        usePlayerStore.getState().setHasHydrated(true);
        
        // If it was also meant to autoplay (rare for rehydration)
        if (store.shouldAutoPlay && !store.isPlaying) {
            console.log('[CanPlay] Rehydrated track also has shouldAutoPlay. Attempting play.');
            if (audioRef.current && audioRef.current.src) {
                audioRef.current.play().catch(e => {
                    console.error("[CanPlay] Rehydrated Auto-play failed", e);
                    setIsLoadingStore(false);
                    setIsPlayingStore(false); // Corrected from storeActions to direct calls
                });
            }
        }
      } else if (store.isLoading) {
        // Standard loading completion (not specific to rehydration seek)
        if (!store.shouldAutoPlay && !store.isPlaying) {
          console.log('[CanPlay] Standard load ready (not autoplaying/playing). Setting isLoading=false.');
          setIsLoadingStore(false);
        } else if (store.shouldAutoPlay && !store.isPlaying) {
            console.log('▶️ Audio Event (CanPlay): shouldAutoPlay is true and not playing. Attempting play.')
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
      console.log('▶️ Audio started playing (event)'); 
      const store = usePlayerStore.getState(); // Get current store state
      if (store.justRehydrated) {
        console.log('[Playing] First play event after rehydration. Setting flags.');
        setJustRehydratedStore(false);
        usePlayerStore.getState().setHasHydrated(true);
      }
      setIsPlayingStore(true); 
      setIsLoadingStore(false); 
    }
    const handlePause = () => { 
      console.log('⏸️ Audio paused (event)'); 
      setIsPlayingStore(false); 
    }
    const handleEnded = () => { 
      console.log('⏹️ Audio ended (event). Calling playNextTrackStore.'); 
      setIsPlayingStore(false); 
      usePlayerStore.getState().playNextTrack();
    }
    const handleError = (e: Event) => { 
      console.error('❌ Audio error (event):', e); 
      setIsLoadingStore(false); 
      setIsPlayingStore(false); 
    }
    const handleLoadStart = () => {
      console.log('⏳ Audio load started (event)');
    }
    const handleWaiting = () => {
      console.log('⏳ Audio waiting for data (buffering)');
      setIsLoadingStore(true);
    }
    const handleStalled = () => {
      console.log('⚠️ Audio stalled (event)');
      setIsLoadingStore(true);
    }
    const handleLoadedMetadata = () => {
      console.log('✅ Audio Event (LoadedMetadata): Fired.');
      const store = usePlayerStore.getState();
      console.log(`[LMD] store.justRehydrated: ${store.justRehydrated}, store.currentTrack: ${!!store.currentTrack}, store.currentTime: ${store.currentTime}`);

      if (audioRef.current) {
        setDurationStore(audioRef.current.duration);
        console.log(`[LMD] Duration set to ${audioRef.current.duration}`);
        
        if (store.justRehydrated && store.currentTrack && store.currentTime > 0) {
          console.log('[LMD] Condition: justRehydrated && currentTrack && currentTime > 0 is TRUE');
          const trackAlbum = store.albumsData?.albums.find(album => 
            album.tracks.some(track => track.file === store.currentTrack!.file)
          );
          if (trackAlbum) {
            console.log('[LMD] Found trackAlbum:', trackAlbum.title);
            const expectedSrcSuffix = `/albums/${trackAlbum.year}-${trackAlbum.slug}/tracks/${store.currentTrack!.file}`;
            const currentAudioSrc = audioRef.current.src ? decodeURIComponent(audioRef.current.src) : "";
            console.log(`[LMD] Expected src suffix: ${expectedSrcSuffix}`);
            console.log(`[LMD] Current audio src: ${currentAudioSrc}`);

            if (currentAudioSrc.endsWith(expectedSrcSuffix)) {
              console.log('[LMD] Rehydration: Src matches. Setting audio.currentTime & isLoading=true. Flags will be set on canplay/playing.');
              audioRef.current.currentTime = store.currentTime;
              setIsLoadingStore(true); // We've seeked, now waiting for it to be playable
              // setJustRehydratedStore(false); // Moved to canplay/playing
              // usePlayerStore.getState().setHasHydrated(true); // Moved to canplay/playing
            } else {
              console.warn('[LMD] Src suffix MISMATCH. Not restoring currentTime. Setting flags.');
              setIsLoadingStore(false); 
              setJustRehydratedStore(false); 
              usePlayerStore.getState().setHasHydrated(true);
            }
          } else {
            console.warn('[LMD] Could not find album for current track. Not restoring currentTime. Setting flags.');
            setIsLoadingStore(false); 
            setJustRehydratedStore(false); 
            usePlayerStore.getState().setHasHydrated(true);
          }
        } else if (store.justRehydrated) {
          console.log('[LMD] Condition: justRehydrated is TRUE, but no currentTrack or currentTime <= 0. Setting flags.');
          // This case means rehydration happened, but no valid track/time to restore.
          setIsLoadingStore(false); 
          setJustRehydratedStore(false);
          usePlayerStore.getState().setHasHydrated(true);
          console.log('[LMD] In else-if for justRehydrated: set isLoading false, justRehydrated false, hydrated true.');
        } else {
          console.log('[LMD] Condition: store.justRehydrated is FALSE. No rehydration logic executed here for time restoration.');
          // Potentially, if it's a normal track load (not rehydration), and we need to reset loading
          // This might be handled by 'playing' or 'canplaythrough'
        }
      } else {
        console.warn('[LMD] audioRef.current is null.');
      }
    }

    console.log('🎧 Setting up audio event listeners in Index.tsx')
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
      console.log('🗑️ Cleaning up audio event listeners in Index.tsx')
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
  }, [audioRef, setIsLoadingStore, setIsPlayingStore, setShouldAutoPlayStore, currentTrack, setDurationStore, setJustRehydratedStore, albumsData, minioPublicUrl]) // Added albumsData and minioPublicUrl as they are used in LMD trackAlbum logic, though indirectly via store.getState()

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
    console.log('🎛️ Volume slider changed to:', value[0])
    setVolumeStore(value);
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