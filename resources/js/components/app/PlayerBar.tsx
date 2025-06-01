import React, { useState, useEffect } from 'react'
import CurrentTrackInfo from './CurrentTrackInfo'
import ProgressBar from './ProgressBar'
import PlayerControls from './PlayerControls'
import VolumeControl from './VolumeControl'
import type { Track, Album } from '@/pages/index'

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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateLocalTime = () => {
      if (!isNaN(audio.currentTime)) {
        setCurrentTime(audio.currentTime)
      }
    }
    const updateLocalDuration = () => {
      if (!isNaN(audio.duration)) {
        setDuration(audio.duration)
      } else {
        setDuration(0) // Reset if duration is not a number (e.g. new track loading)
      }
    }

    // Initial sync and event listeners
    updateLocalDuration() // Sync duration on mount/track change
    updateLocalTime()     // Sync time on mount/track change

    audio.addEventListener('timeupdate', updateLocalTime)
    audio.addEventListener('loadedmetadata', updateLocalDuration)
    audio.addEventListener('durationchange', updateLocalDuration); // Handle duration changes (e.g. for live streams or when metadata isn't fully loaded initially)
    audio.addEventListener('emptied', () => { // Reset when src changes and audio is emptied
        setCurrentTime(0);
        setDuration(0);
    });

    return () => {
      audio.removeEventListener('timeupdate', updateLocalTime)
      audio.removeEventListener('loadedmetadata', updateLocalDuration)
      audio.removeEventListener('durationchange', updateLocalDuration);
      audio.removeEventListener('emptied', () => {
        setCurrentTime(0);
        setDuration(0);
    });
    }
  }, [audioRef, currentTrack]) // Re-run when audioRef or currentTrack changes

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