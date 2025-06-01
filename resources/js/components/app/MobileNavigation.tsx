import React, { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Disc, List } from 'lucide-react'

interface MobileNavigationProps {
  mobileView: 'albums' | 'tracks'
  onSetMobileView: (view: 'albums' | 'tracks') => void
  hasSelectedAlbum: boolean
}

const MobileNavigationInternal: React.FC<MobileNavigationProps> = ({
  mobileView,
  onSetMobileView,
  hasSelectedAlbum,
}) => {
  return (
    <div className="border-b grid grid-cols-2 divide-x">
      <Button
        variant={mobileView === 'albums' ? 'default' : 'ghost'}
        className="rounded-none h-12"
        onClick={() => onSetMobileView('albums')}
      >
        <Disc className="h-4 w-4 mr-2" />
        Albümler
      </Button>
      <Button
        variant={mobileView === 'tracks' ? 'default' : 'ghost'}
        className="rounded-none h-12"
        onClick={() => {
          if (hasSelectedAlbum) {
            onSetMobileView('tracks')
          }
        }}
        disabled={!hasSelectedAlbum}
      >
        <List className="h-4 w-4 mr-2" />
        Şarkılar
      </Button>
    </div>
  )
}

export default memo(MobileNavigationInternal) 