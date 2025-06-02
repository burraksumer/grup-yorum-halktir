import React, { useEffect, useCallback } from 'react'
import CurrentTrackInfo from './CurrentTrackInfo'
import ProgressBar from './ProgressBar'
import PlayerControls from './PlayerControls'
import VolumeControl from './VolumeControl'
import type { Track, Album } from '@/store/playerStore'
import { usePlayerStore } from '@/store/playerStore'

interface PlayerBarProps {
  audioRef: React.RefObject<HTMLAudioElement | null>
  minioPublicUrl: string
  currentTrack: Track | null
  playingAlbum: Album | null
  onProgressChange: (value: number[]) => void
  togglePlayPause: () => void
  playNextTrack: () => void
  playPrevTrack: () => void
  isPlaying: boolean
  isLoading: boolean
  isFirstTrack: boolean
  isLastTrack: boolean
  hasCurrentTrack: boolean
  volume: number[]
  handleVolumeChange: (value: number[]) => void
  isMobile: boolean
}

const PlayerBar: React.FC<PlayerBarProps> = ({
  audioRef,
  minioPublicUrl,
  currentTrack,
  playingAlbum,
  onProgressChange,
  togglePlayPause,
  playNextTrack,
  playPrevTrack,
  isPlaying,
  isLoading,
  isFirstTrack,
  isLastTrack,
  hasCurrentTrack,
  volume,
  handleVolumeChange,
  isMobile,
}) => {
  const currentTime = usePlayerStore(state => state.currentTime)
  const duration = usePlayerStore(state => state.duration)
  const setCurrentTimeStore = usePlayerStore(state => state.setCurrentTime)
  const setDurationStore = usePlayerStore(state => state.setDuration)
  const justRehydrated = usePlayerStore(state => state.justRehydrated)

  // Define the event handler as a useCallback to ensure it has a stable reference
  // and to correctly remove it in the cleanup function.
  const handleEmptiedPlayerBar = useCallback(() => {
    console.log('🧹 PlayerBar Event (Emptied): Resetting duration.');
    // We should NOT reset currentTime here as it might be rehydrated.
    // currentTime should be reset by specific actions like new track selection.
    setDurationStore(0);
  }, [setDurationStore]);

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateLocalTime = () => {
      // If the store indicates we just rehydrated, don't update currentTime from the audio element yet.
      // Let index.tsx handle restoring currentTime from the store first.
      if (usePlayerStore.getState().justRehydrated) { 
        // console.log('[PlayerBar updateLocalTime] Skipping update, justRehydrated is true.');
        return;
      }
      if (!isNaN(audio.currentTime)) {
        setCurrentTimeStore(audio.currentTime)
      }
    }
    const updateLocalDuration = () => {
      if (!isNaN(audio.duration)) {
        setDurationStore(audio.duration)
      } else {
        setDurationStore(0) // Reset if duration is not a number (e.g. new track loading)
      }
    }

    // Event listeners will handle syncing. Removed direct calls to updateLocalTime() and updateLocalDuration().
    // updateLocalDuration() // REMOVED: Sync duration on mount/track change
    // updateLocalTime()     // REMOVED: Sync time on mount/track change

    audio.addEventListener('timeupdate', updateLocalTime)
    audio.addEventListener('loadedmetadata', updateLocalDuration)
    audio.addEventListener('durationchange', updateLocalDuration); // Handle duration changes (e.g. for live streams or when metadata isn't fully loaded initially)
    audio.addEventListener('emptied', handleEmptiedPlayerBar); // Use the named handler

    return () => {
      audio.removeEventListener('timeupdate', updateLocalTime)
      audio.removeEventListener('loadedmetadata', updateLocalDuration)
      audio.removeEventListener('durationchange', updateLocalDuration)
      audio.removeEventListener('emptied', handleEmptiedPlayerBar); // Use the same named handler for removal
    }
  }, [audioRef, currentTrack, setCurrentTimeStore, setDurationStore, handleEmptiedPlayerBar, justRehydrated]) // Added justRehydrated to dependencies

  if (isMobile) {
    return (
      <footer className="border-t bg-card p-4">
        <audio ref={audioRef} preload="metadata" />
        <div className="flex flex-col gap-3">
          <CurrentTrackInfo
            currentTrack={currentTrack}
            playingAlbum={playingAlbum}
            minioPublicUrl={minioPublicUrl}
            isMobile={true}
          />
          {currentTrack && (
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onProgressChange={onProgressChange}
              className="mt-1 w-full"
            />
          )}
          <div className="flex items-center justify-center">
            <PlayerControls
              onPlayPause={togglePlayPause}
              onNext={playNextTrack}
              onPrevious={playPrevTrack}
              isPlaying={isPlaying}
              isLoading={isLoading}
              isFirstTrack={isFirstTrack}
              isLastTrack={isLastTrack}
              hasCurrentTrack={hasCurrentTrack}
              isMobile={true}
            />
          </div>
        </div>
      </footer>
    )
  }

  // Desktop Layout
  return (
    <footer className="border-t bg-card p-4">
      <audio ref={audioRef} preload="metadata" />
      <div className="flex items-center justify-between">
        <CurrentTrackInfo
          currentTrack={currentTrack}
          playingAlbum={playingAlbum}
          minioPublicUrl={minioPublicUrl}
        />
        <div className="flex flex-col items-center flex-1">
          <div className="flex items-center gap-2 mb-2">
            <PlayerControls
              onPlayPause={togglePlayPause}
              onNext={playNextTrack}
              onPrevious={playPrevTrack}
              isPlaying={isPlaying}
              isLoading={isLoading}
              isFirstTrack={isFirstTrack}
              isLastTrack={isLastTrack}
              hasCurrentTrack={hasCurrentTrack}
            />
          </div>
          {currentTrack && (
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onProgressChange={onProgressChange}
              className="max-w-md"
            />
          )}
        </div>
        <VolumeControl volume={volume} onVolumeChange={handleVolumeChange} />
      </div>
    </footer>
  )
}

export default PlayerBar 