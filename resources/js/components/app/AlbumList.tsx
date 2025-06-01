import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Music } from 'lucide-react' // Çalma durumu göstergesi için
import type { Album } from '@/pages/index'

interface AlbumListProps {
  albums: Album[]
  selectedAlbumId: number | null // Sadece ID'yi almak yeterli olabilir
  playingAlbumId: number | null // Sadece ID'yi almak yeterli olabilir
  isPlaying: boolean
  minioPublicUrl: string
  onAlbumSelect: (album: Album) => void
  // Mobil için ek bir prop, albüm seçildiğinde görünüm değiştirmek için
  onAlbumSelectMobile?: () => void 
  isMobile?: boolean
}

const AlbumListInternal: React.FC<AlbumListProps> = ({
  albums,
  selectedAlbumId,
  playingAlbumId,
  isPlaying,
  minioPublicUrl,
  onAlbumSelect,
  onAlbumSelectMobile,
  isMobile = false,
}) => {
  return (
    <div className={isMobile ? "grid gap-3" : "grid gap-3 px-4"}>
      {albums.map((album) => (
        <Card
          key={album.id}
          className={`cursor-pointer transition-all hover:bg-accent ${
            selectedAlbumId === album.id ? 'bg-accent border-primary' : ''
          }`}
          onClick={() => {
            onAlbumSelect(album)
            if (isMobile && onAlbumSelectMobile) {
              onAlbumSelectMobile()
            }
          }}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-md">
                <AvatarImage src={`${minioPublicUrl}/albums/${album.year}-${album.slug}/cover.jpg`} />
                <AvatarFallback className="rounded-md">
                  {album.year}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{album.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {album.year} • {album.trackCount} şarkı
                </p>
              </div>
              {playingAlbumId === album.id && (
                <div className="flex items-center">
                  {isPlaying ? (
                    <Music className="h-4 w-4 text-green-500 animate-pulse" />
                  ) : (
                    <Music className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default memo(AlbumListInternal) 