import React, { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Music } from 'lucide-react'
import type { Album, AlbumsData } from '@/pages/index' // AlbumsData da lazım olacak

interface DesktopHeaderProps {
  albumsData: AlbumsData // totalAlbums ve tüm albümlerin trackCount toplamı için
  selectedAlbum: Album | null
  playingAlbum: Album | null
  onSetSelectedAlbum: (album: Album) => void // Çalan albüme dön butonu için
}

const DesktopHeaderInternal: React.FC<DesktopHeaderProps> = ({
  albumsData,
  selectedAlbum,
  playingAlbum,
  onSetSelectedAlbum,
}) => {
  const totalTracks = albumsData.albums.reduce((acc: number, album: Album) => acc + album.trackCount, 0)

  return (
    <header className="border-b p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Grup Yorum</h1>
            <p className="text-muted-foreground">Halk Türküleri</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {playingAlbum && selectedAlbum?.id !== playingAlbum.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetSelectedAlbum(playingAlbum)} // playingAlbum null olamaz bu durumda
              className="flex items-center gap-2 mr-3"
            >
              <Music className="h-4 w-4" />
              <span className="hidden sm:inline">Çalan Albüm:</span>
              <span className="font-medium">{playingAlbum.title}</span>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {albumsData.totalAlbums} Albüm • {totalTracks} Şarkı
          </span>
        </div>
      </div>
    </header>
  )
}

export default memo(DesktopHeaderInternal) 