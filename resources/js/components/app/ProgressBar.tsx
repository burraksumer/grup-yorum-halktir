import React, { memo } from 'react'
import { Slider } from '@/components/ui/slider'

interface ProgressBarProps {
  currentTime: number
  duration: number
  onProgressChange: (value: number[]) => void
  className?: string
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const ProgressBarInternal: React.FC<ProgressBarProps> = ({
  currentTime,
  duration,
  onProgressChange,
  className,
}) => {
  return (
    <div className={`flex items-center gap-2 w-full ${className}`}>
      <span className="text-xs text-muted-foreground w-10 text-right">
        {formatTime(currentTime)}
      </span>
      <Slider
        value={[currentTime]}
        onValueChange={onProgressChange}
        max={duration || 100} // Eğer duration 0 ise, slider çökmesin diye 100 varsayalım
        step={1}
        className="flex-1"
      />
      <span className="text-xs text-muted-foreground w-10">
        {formatTime(duration)}
      </span>
    </div>
  )
}

export default memo(ProgressBarInternal) 