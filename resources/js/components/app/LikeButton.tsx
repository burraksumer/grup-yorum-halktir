import React from 'react';
import { Heart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Link } from '@inertiajs/react';

interface LikeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  albumId: number;
  trackNumber: number;
}

export default function LikeButton({ albumId, trackNumber, className, ...props }: LikeButtonProps) {
  const isAuthenticated = useUserStore(state => state.isAuthenticated);
  const likedTracks = useUserStore(state => state.likedTracks);
  const toggleLikeTrack = useUserStore(state => state.toggleLikeTrack);
  const isLoadingAuth = useUserStore(state => state.isLoadingAuth);
  const isLoadingLikes = useUserStore(state => state.isLoadingLikes);
  const [isToggling, setIsToggling] = React.useState(false);
  const [showLoginModal, setShowLoginModal] = React.useState(false);

  if (albumId === undefined || albumId === null || trackNumber === undefined || trackNumber === null) {
    return null;
  }

  const trackKey = `${albumId}||${trackNumber}`;
  const isLiked = likedTracks.has(trackKey);

  const handleLikeToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (isToggling) return;

    setIsToggling(true);
    try {
      await toggleLikeTrack(albumId, trackNumber);
    } catch (error) {
      console.error('Failed to toggle like from button:', error);
    }
    setIsToggling(false);
  };

  const isDisabled = isLoadingAuth || isLoadingLikes || isToggling;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLikeToggle}
        disabled={isDisabled}
        className={cn("rounded-full", className)}
        {...props}
      >
        <Heart className={cn("h-5 w-5", isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground')} />
        <span className="sr-only">{isLiked ? 'Unlike' : 'Like'}</span>
      </Button>

      <AlertDialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <AlertDialogContent className="min-h-[180px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Giriş Gerekli</AlertDialogTitle>
            <AlertDialogCancel className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Kapat</span>
            </AlertDialogCancel>
          </AlertDialogHeader>
          <AlertDialogDescription className="mt-2 text-sm text-muted-foreground">
            Şarkıları beğenebilmek için lütfen <Link href={route('login')} className="font-semibold text-primary hover:underline" onClick={() => setShowLoginModal(false)}>giriş yapın</Link> veya <Link href={route('register')} className="font-semibold text-primary hover:underline" onClick={() => setShowLoginModal(false)}>yeni bir hesap oluşturun</Link>.
          </AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 