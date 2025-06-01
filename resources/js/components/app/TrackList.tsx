import React, { memo } from 'react'
import { Loader2, Music } from 'lucide-react' // Music ikonu ileride çalma durumu için eklenebilir
import type { Track } from '@/pages/index'

interface TrackListProps {
  tracks: Track[]
  currentTrack: Track | null
  isPlaying: boolean
  isLoading: boolean // O anki şarkı mı yükleniyor, yoksa genel bir yükleme durumu mu?
  onTrackSelect: (track: Track) => void
  className?: string
}

const TrackListInternal: React.FC<TrackListProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  isLoading, 
  onTrackSelect,
  className,
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {tracks.map((track) => (
        <div
          key={`${track.disc || 1}-${track.track}`}
          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
            currentTrack?.file === track.file ? 'bg-accent' : ''
          }`}
          onClick={() => onTrackSelect(track)}
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
          {/* Masaüstü için Heart butonu vardı, onu da buraya alabiliriz veya ayrı bir bileşen yapabiliriz.
          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100">
            <Heart className="h-4 w-4" />
          </Button> 
          */}
        </div>
      ))}
    </div>
  )
}

export default memo(TrackListInternal) 