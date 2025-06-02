import React, { useEffect, useCallback } from 'react'
import CurrentTrackInfo from './CurrentTrackInfo'
import ProgressBar from './ProgressBar'
import PlayerControls from './PlayerControls'
import VolumeControl from './VolumeControl'
import LikeButton from './LikeButton'
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

  const handleEmptiedPlayerBar = useCallback(() => {
    // We should NOT reset currentTime here as it might be rehydrated.
    // currentTime should be reset by specific actions like new track selection.
    setDurationStore(0);
  }, [setDurationStore]);

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateLocalTime = () => {
      if (usePlayerStore.getState().justRehydrated) { 
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
        setDurationStore(0) 
      }
    }

    audio.addEventListener('timeupdate', updateLocalTime)
    audio.addEventListener('loadedmetadata', updateLocalDuration)
    audio.addEventListener('durationchange', updateLocalDuration);
    audio.addEventListener('emptied', handleEmptiedPlayerBar);

    return () => {
      audio.removeEventListener('timeupdate', updateLocalTime)
      audio.removeEventListener('loadedmetadata', updateLocalDuration)
      audio.removeEventListener('durationchange', updateLocalDuration)
      audio.removeEventListener('emptied', handleEmptiedPlayerBar);
    }
    // currentTrack is not strictly needed here as a dependency if its change triggers 
    // other effects that re-evaluate or re-attach listeners. 
    // However, keeping it can ensure listeners are fresh if the track object identity changes.
    // justRehydrated is also not directly used in this effect's body, but its change should trigger re-evaluation due to updateLocalTime logic.
  }, [audioRef, currentTrack, setCurrentTimeStore, setDurationStore, handleEmptiedPlayerBar]) 

  if (isMobile) {
    return (
      <footer className="border-t bg-card p-4">
        <audio ref={audioRef} preload="metadata" />
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CurrentTrackInfo
              currentTrack={currentTrack}
              playingAlbum={playingAlbum}
              minioPublicUrl={minioPublicUrl}
              isMobile={true}
              className="flex-grow min-w-0"
            />
            {currentTrack && playingAlbum && (
              <LikeButton
                albumId={playingAlbum.id}
                trackNumber={currentTrack.track}
                className="ml-2 flex-shrink-0"
              />
            )}
          </div>
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
          className="min-w-0"
        />
        <div className="flex flex-col items-center flex-1 mx-4">
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
            {currentTrack && playingAlbum && (
              <LikeButton
                albumId={playingAlbum.id}
                trackNumber={currentTrack.track}
                className="ml-2"
              />
            )}
          </div>
          {currentTrack && (
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onProgressChange={onProgressChange}
              className="w-full max-w-md"
            />
          )}
        </div>
        <VolumeControl volume={volume} onVolumeChange={handleVolumeChange} />
      </div>
    </footer>
  )
}

export default PlayerBar 