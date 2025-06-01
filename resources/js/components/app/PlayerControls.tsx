import React, { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Pause, SkipBack, SkipForward, Loader2 } from 'lucide-react'

interface PlayerControlsProps {
  onPlayPause: () => void
  onNext: () => void
  onPrevious: () => void
  isPlaying: boolean
  isLoading: boolean
  isFirstTrack: boolean
  isLastTrack: boolean
  hasCurrentTrack: boolean
  isMobile?: boolean // Mobil ve masaüstü için farklı buton boyutları olabilir
}

const PlayerControlsInternal: React.FC<PlayerControlsProps> = ({
  onPlayPause,
  onNext,
  onPrevious,
  isPlaying,
  isLoading,
  isFirstTrack,
  isLastTrack,
  hasCurrentTrack,
  isMobile = false,
}) => {
  const buttonSize = isMobile ? 'icon' : 'sm'

  return (
    <div className="flex items-center gap-2">
      <Button size={buttonSize} variant="ghost" onClick={onPrevious} disabled={isFirstTrack || !hasCurrentTrack}>
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button size={buttonSize} onClick={onPlayPause} disabled={!hasCurrentTrack}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <Button size={buttonSize} variant="ghost" onClick={onNext} disabled={isLastTrack || !hasCurrentTrack}>
        <SkipForward className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default memo(PlayerControlsInternal) 