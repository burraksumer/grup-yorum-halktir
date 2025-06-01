import React, { memo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Album } from '@/pages/index'

interface AlbumDetailHeaderProps {
  selectedAlbum: Album // Bu bileşen sadece seçili albüm varsa render edilecek
  minioPublicUrl: string
  isMobile?: boolean
}

const AlbumDetailHeaderInternal: React.FC<AlbumDetailHeaderProps> = ({
  selectedAlbum,
  minioPublicUrl,
  isMobile = false,
}) => {
  const avatarSize = isMobile ? 'h-16 w-16' : 'h-20 w-20'
  const titleSize = isMobile ? 'text-xl' : 'text-2xl'
  const textSize = isMobile ? 'text-sm' : 'text-base'

  return (
    <div className={`flex items-start gap-4 ${isMobile ? 'mb-4' : 'mb-6'}`}>
      <Avatar className={`${avatarSize} rounded-lg`}>
        <AvatarImage src={`${minioPublicUrl}/albums/${selectedAlbum.year}-${selectedAlbum.slug}/cover.jpg`} />
        <AvatarFallback className="rounded-lg text-lg">
          {selectedAlbum.year}
        </AvatarFallback>
      </Avatar>
      <div>
        <h2 className={`${titleSize} font-bold`}>{selectedAlbum.title}</h2>
        <p className={`text-muted-foreground ${textSize}`}>
          {selectedAlbum.year} • {selectedAlbum.trackCount} şarkı
        </p>
        {selectedAlbum.description && (
          <p className={`text-sm text-muted-foreground mt-1 ${textSize}`}>
            {selectedAlbum.description}
          </p>
        )}
      </div>
    </div>
  )
}

export default memo(AlbumDetailHeaderInternal) 