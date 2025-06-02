import React, { memo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Track, Album } from '@/store/playerStore'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/store/playerStore'

interface CurrentTrackInfoProps {
  currentTrack: Track | null
  playingAlbum: Album | null
  minioPublicUrl: string
  isMobile?: boolean
  className?: string
}

const CurrentTrackInfoInternal: React.FC<CurrentTrackInfoProps> = ({
  currentTrack,
  playingAlbum,
  minioPublicUrl,
  isMobile = false,
  className,
}) => {
  const displayAlbum = currentTrack?.albumSlug 
    ? usePlayerStore.getState().albumsData?.albums.find(a => a.slug === currentTrack.albumSlug)
    : playingAlbum;

  if (!currentTrack) {
    return (
      <div className={cn("flex items-center gap-3 flex-1", className)}>
        <div className={cn(`h-12 w-12 rounded-md bg-muted flex items-center justify-center`, isMobile ? 'h-10 w-10' : 'h-12 w-12')}>
          <span className="text-muted-foreground">♪</span>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Şarkı seçin</p>
        </div>
      </div>
    )
  }

  const avatarSize = isMobile ? 'h-10 w-10' : 'h-12 w-12'
  const albumForDisplay = displayAlbum || playingAlbum;

  return (
    <div className={cn("flex items-center gap-3 flex-1 min-w-0", className)}>
      <Avatar className={cn(avatarSize, "rounded-md")}>
        {albumForDisplay && (
          <AvatarImage src={`${minioPublicUrl}/albums/${albumForDisplay.year}-${albumForDisplay.slug}/cover.jpg`} alt={albumForDisplay.title} />
        )}
        <AvatarFallback className="rounded-md">♪</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm truncate">{currentTrack.title}</p>
        <p className="text-xs text-muted-foreground truncate">
            {albumForDisplay ? albumForDisplay.title : "Grup Yorum"}
        </p>
      </div>
    </div>
  )
}

export default memo(CurrentTrackInfoInternal) 