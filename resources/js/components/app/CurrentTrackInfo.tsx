import React, { memo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Track, Album } from '@/pages/index' // Tipleri ana sayfadan alacağız

interface CurrentTrackInfoProps {
  currentTrack: Track | null
  playingAlbum: Album | null
  minioPublicUrl: string
  isMobile?: boolean
}

const CurrentTrackInfoInternal: React.FC<CurrentTrackInfoProps> = ({
  currentTrack,
  playingAlbum,
  minioPublicUrl,
  isMobile = false,
}) => {
  if (!currentTrack || !playingAlbum) {
    return (
      <div className="flex items-center gap-3 flex-1">
        <div className={`h-12 w-12 rounded-md bg-muted flex items-center justify-center`}>
          <span className="text-muted-foreground">♪</span>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Şarkı seçin</p>
        </div>
      </div>
    )
  }

  const avatarSize = isMobile ? 'h-12 w-12' : 'h-12 w-12' // Şimdilik aynı, gerekirse değiştirilebilir

  return (
    <div className="flex items-center gap-3 flex-1">
      <Avatar className={`${avatarSize} rounded-md`}>
        <AvatarImage src={`${minioPublicUrl}/albums/${playingAlbum.year}-${playingAlbum.slug}/cover.jpg`} />
        <AvatarFallback className="rounded-md">♪</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm truncate">{currentTrack.title}</p>
        <p className="text-xs text-muted-foreground">Grup Yorum</p>
      </div>
    </div>
  )
}

export default memo(CurrentTrackInfoInternal) 