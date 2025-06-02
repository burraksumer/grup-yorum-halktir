import React, { memo } from 'react'
import { Loader2 } from 'lucide-react' // Music ikonu kaldırıldı
import type { Track } from '@/store/playerStore'
import LikeButton from './LikeButton'
import { cn } from '@/lib/utils'

interface TrackListProps {
  tracks: Track[]
  albumId: number
  albumSlug: string
  currentTrack: Track | null
  isPlaying: boolean
  isLoading: boolean // O anki şarkı mı yükleniyor, yoksa genel bir yükleme durumu mu?
  onTrackSelect: (track: Track) => void
  className?: string
}

const TrackListInternal: React.FC<TrackListProps> = ({
  tracks,
  albumId,
  albumSlug,
  currentTrack,
  isPlaying,
  isLoading, 
  onTrackSelect,
  className,
}) => {
  return (
    <div className={cn("space-y-1", className)}>
      {tracks.map((track) => (
        <div
          key={`${albumSlug}-${track.file}`}
          className={cn(
            "flex items-center gap-3 p-2 rounded-md group",
            currentTrack?.file === track.file && currentTrack?.albumSlug === albumSlug 
              ? "bg-accent cursor-default"
              : "hover:bg-accent cursor-pointer"
          )}
          onClick={() => {
            if (!(currentTrack?.file === track.file && currentTrack?.albumSlug === albumSlug)) {
              onTrackSelect(track);   
            }
          }}
        >
          <div className="w-8 text-center">
            {currentTrack?.file === track.file && currentTrack?.albumSlug === albumSlug && isPlaying ? (
              <div className="w-4 h-4 bg-primary rounded-full mx-auto animate-pulse" />
            ) : currentTrack?.file === track.file && currentTrack?.albumSlug === albumSlug && isLoading ? (
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
          <LikeButton 
            albumId={albumId}
            trackNumber={track.track}
            className="ml-auto transition-opacity duration-150"
          />
        </div>
      ))}
    </div>
  )
}

export default memo(TrackListInternal) 