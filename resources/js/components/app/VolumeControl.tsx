import React, { memo } from 'react'
import { Slider } from '@/components/ui/slider'
import { Volume2 } from 'lucide-react'

interface VolumeControlProps {
  volume: number[]
  onVolumeChange: (value: number[]) => void
  className?: string
}

const VolumeControlInternal: React.FC<VolumeControlProps> = ({
  volume,
  onVolumeChange,
  className,
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Volume2 className="h-4 w-4" />
      <Slider
        value={volume}
        onValueChange={onVolumeChange}
        max={100}
        step={1}
        className="w-24"
      />
    </div>
  )
}

export default memo(VolumeControlInternal) 