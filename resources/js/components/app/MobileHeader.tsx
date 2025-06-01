import React, { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Music } from 'lucide-react'
import type { Album } from '@/pages/index'

interface MobileHeaderProps {
  playingAlbum: Album | null
  onGoToPlayingAlbum: () => void // Çalan albüme gitme fonksiyonu
}

const MobileHeaderInternal: React.FC<MobileHeaderProps> = ({
  playingAlbum,
  onGoToPlayingAlbum,
}) => {
  return (
    <header className="border-b p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Grup Yorum</h1>
          <p className="text-muted-foreground text-sm">Halk Türküleri</p>
        </div>

        <div className="flex items-center gap-2">
          {playingAlbum && (
            <Button
              variant="outline"
              size="sm"
              onClick={onGoToPlayingAlbum}
              className="flex items-center gap-2"
            >
              <Music className="h-4 w-4" />
              <span className="font-medium">Çalan Albüm</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

export default memo(MobileHeaderInternal) 