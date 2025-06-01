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

  const isMobile = useIsMobile()
  const audioRef = useRef<HTMLAudioElement>(null)

  // Load albums metadata
  useEffect(() => {
    fetchAlbumsAndSetInitialTrackStore(minioPublicUrl);
  }, [fetchAlbumsAndSetInitialTrackStore, minioPublicUrl]);

  // Effect 1: Handles setting the audio source, volume, and initial play for new tracks
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    // Set volume whenever it changes in the store
    const linearVolume = volume[0] / 100;
    const curvedVolume = Math.pow(linearVolume, 2);
    audio.volume = curvedVolume;
    if (audio.muted && volume[0] > 0) {
        // console.log('🔊 Audio Effect: Unmuting due to volume change');
        // audio.muted = false; // Let user control mute explicitly, volume change shouldn't force unmute.
    }
    console.log(`🔊 Audio Effect (Volume): Set to ${volume[0]}% -> ${(curvedVolume * 100).toFixed(1)}%`);

    if (currentTrack && albumsData) {
      const trackAlbum = albumsData.albums.find(album => 
        album.tracks.some(track => track.file === currentTrack.file)
      );
      if (!trackAlbum) {
        console.error('❌ Audio Effect: Could not find album for current track', currentTrack.title);
        return;
      }

      const newTrackUrl = `${minioPublicUrl}/albums/${trackAlbum.year}-${trackAlbum.slug}/tracks/${currentTrack.file}`;
      const currentAudioSrc = audio.src.endsWith(newTrackUrl.substring(newTrackUrl.lastIndexOf('/') + 1)) ? audio.src : decodeURIComponent(audio.src);
      
      console.log('🔄 Audio Effect (Track Change?):');
      console.log('  🎵 CT:', currentTrack.title);
      console.log('  🆕 New URL:', newTrackUrl);
      console.log('  🎧 Existing Src:', currentAudioSrc);
      console.log('  🤖 SA:', shouldAutoPlay);

      if (currentAudioSrc !== newTrackUrl) {
        console.log(`✅ Audio Effect: Setting new src: ${newTrackUrl}`);
        audio.src = newTrackUrl;
        // When src changes, browser automatically stops playback.
        // We should explicitly load and then play if shouldAutoPlay is true.
        setIsLoadingStore(true); // Show loading for new track
        audio.load(); // Important to load the new source
        if (shouldAutoPlay) {
          // Play will be attempted by the play/pause effect or by the 'canplay' event setting isPlaying.
          // For now, let's set isPlaying to true to trigger the other effect if needed.
          // Or, more directly, the store's setCurrentTrack already sets shouldAutoPlay.
          // The play/pause effect will pick up isPlaying=true if shouldAutoPlay was true.
          // Let's rely on the play/pause effect to handle the actual play command after src is set and loaded.
          console.log('🚀 Audio Effect: New track source set, shouldAutoPlay is true. isPlaying will trigger play.');
          // We set isPlaying true in store if shouldAutoPlay. This will trigger the other useEffect.
          // usePlayerStore.getState().setIsPlaying(true); //This might be too soon, wait for canplay
        } else {
          // If not auto-playing, ensure isPlaying is false and loading is false after src change
          // setIsPlayingStore(false); // setCurrentTrack in store already sets isPlaying to false initially
          // setIsLoadingStore(false); // isLoading will be false once 'canplay' or 'playing' occurs
        }
      } 
    } else if (!currentTrack) {
      console.log('🔇 Audio Effect: No current track. Clearing src and pausing.');
      audio.src = '';
      if (!audio.paused) audio.pause();
      setIsLoadingStore(false); // No track, not loading
      setIsPlayingStore(false); // No track, not playing
    }
  }, [currentTrack, volume, minioPublicUrl, albumsData, setIsLoadingStore, setIsPlayingStore, shouldAutoPlay]); // Keep shouldAutoPlay here for new track logic


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
      const storeActions = usePlayerStore.getState();
      // If it was loading and is the current track, mark as not loading.
      // If shouldAutoPlay was true for this track and it's now ready, isPlaying should become true.
      if (storeActions.isLoading && audioRef.current?.src && audioRef.current.src.includes(storeActions.currentTrack?.file || '###NOFILE###')) {
        // setIsLoadingStore(false); // isLoading is set to false by 'playing' event or if play fails
        if (storeActions.shouldAutoPlay && !storeActions.isPlaying) {
            console.log('▶️ Audio Event (CanPlay): shouldAutoPlay is true and not playing. Setting isPlaying to true.')
            // This will trigger the play/pause useEffect to call audio.play()
            // setIsPlayingStore(true); 
            // Let's try to play directly here if it was meant to autoplay and src is set
            if (audioRef.current && audioRef.current.src) {
                audioRef.current.play().catch(e => {
                    console.error("❌ Audio Event (CanPlay): Auto-play failed", e);
                    storeActions.setIsLoading(false);
                    storeActions.setIsPlaying(false);
                });
            } else {
                 storeActions.setIsLoading(false); // No src, so not loading
            }
        } else if (!storeActions.shouldAutoPlay && !storeActions.isPlaying) {
            // If it was not meant to auto-play and not playing, it means it's loaded but paused.
            storeActions.setIsLoading(false);
        }
      }
    }
    const handlePlaying = () => { 
      console.log('▶️ Audio started playing (event)'); 
      setIsPlayingStore(true); 
      setIsLoadingStore(false); 
      setShouldAutoPlayStore(false);
    }
    const handlePause = () => { 
      console.log('⏸️ Audio paused (event)'); 
      setIsPlayingStore(false); 
    }
    const handleEnded = () => { 
      console.log('�� Audio ended (event). Calling playNextTrackStore.'); 
      setIsPlayingStore(false); 
      // setIsLoadingStore(false); // Not needed, playNextTrackStore will handle loading for the new track if any
      // setTrackEnded(true); // Remove, call playNextTrackStore directly
      usePlayerStore.getState().playNextTrack(); // Call store action directly
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

    console.log('🎧 Setting up audio event listeners in Index.tsx')
    audio.addEventListener('canplaythrough', handleCanPlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('loadstart', handleLoadStart); 
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('stalled', handleStalled);

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
    }
  }, [audioRef, setIsLoadingStore, setIsPlayingStore, setShouldAutoPlayStore, currentTrack])

  const getIsLoading = useCallback(() => usePlayerStore.getState().isLoading, []);
  const getAudioSrc = useCallback(() => audioRef.current?.src || '', []);

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
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
    }
  }, [audioRef])

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