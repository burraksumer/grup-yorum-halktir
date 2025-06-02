import { create, type StoreApi } from 'zustand';
import { persist, createJSONStorage, type PersistOptions, type StateStorage, type StorageValue } from 'zustand/middleware';

export interface Track {
  track: number;
  title: string;
  file: string;
  disc?: number;
  shouldAutoPlay: boolean;
  currentTime: number;
  duration: number;
}

export interface Album {
  id: number;
  title: string;
  year: number;
  slug: string;
  cover: string;
  trackCount: number;
  tracks: Track[];
  description?: string;
}

export interface AlbumsData {
  artist: string;
  totalAlbums: number;
  albums: Album[];
}

export interface PlayerState {
  // Initial simple states
  volume: number[];
  mobileView: 'albums' | 'tracks';
  _hasHydrated: boolean; // For tracking hydration status
  justRehydrated: boolean; // Flag to indicate if current track was just rehydrated

  // Placeholder for other states - will be added progressively
  albumsData: AlbumsData | null;
  selectedAlbum: Album | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  shouldAutoPlay: boolean;
  currentTime: number;
  duration: number;

  // --- Actions ---
  fetchAlbumsAndSetInitialTrack: () => Promise<void>;
  setVolume: (volume: number[]) => void;
  setMobileView: (view: 'albums' | 'tracks') => void;

  // Placeholder for other actions - will be added progressively
  setAlbumsData: (data: AlbumsData) => void;
  setSelectedAlbum: (album: Album) => void;
  setCurrentTrack: (track: Track, autoPlay?: boolean) => void;
  togglePlay: () => void;
  setIsLoading: (loading: boolean) => void;
  setShouldAutoPlay: (autoPlay: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  playNextTrack: () => void;
  playPrevTrack: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  handleProgressChange: (newTime: number) => void;
  setHasHydrated: (hydrated: boolean) => void; // Action to set hydration status
  setJustRehydrated: (rehydrated: boolean) => void; // Action for the flag
}

// Define the shape of the persisted state explicitly for partialize
type PersistedPlayerState = Pick<PlayerState, 'currentTrack' | 'currentTime' | 'volume'>;

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // Initial values
      volume: [typeof window !== 'undefined' ? parseInt(localStorage.getItem('grup-yorum-volume') || '75', 10) : 75],
      mobileView: 'albums',
      _hasHydrated: false,
      justRehydrated: false,
      
      albumsData: null,
      selectedAlbum: null,
      currentTrack: null,
      isPlaying: false,
      isLoading: true, 
      shouldAutoPlay: false,
      currentTime: 0,
      duration: 0,

      // --- Actions ---
      setHasHydrated: (hydrated: boolean) => set({ _hasHydrated: hydrated }),
      setJustRehydrated: (rehydrated: boolean) => set({ justRehydrated: rehydrated }),
      fetchAlbumsAndSetInitialTrack: async () => { 
        const { currentTrack: existingCurrentTrack, justRehydrated: isJustRehydrated } = get(); 
        
        if (!existingCurrentTrack && !isJustRehydrated) {
            set({ isLoading: true });
        }

        try {
          const response = await fetch('/all_albums_metadata.json');
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data: AlbumsData = await response.json();
          
          const { currentTrack: currentTrackAfterFetch, selectedAlbum: selectedAlbumAfterFetch, justRehydrated: isStillJustRehydrated } = get();
          let newCurrentTrack = currentTrackAfterFetch;
          let newSelectedAlbum = selectedAlbumAfterFetch;

          if (!newCurrentTrack && data.albums.length > 0) {
            const firstAlbum = data.albums[0];
            newSelectedAlbum = firstAlbum;
            if (firstAlbum.tracks.length > 0) {
              newCurrentTrack = firstAlbum.tracks[0];
            }
          } else if (newCurrentTrack && data.albums.length > 0) {
            const trackAlbum = data.albums.find(album => 
                album.tracks.some(track => track.file === newCurrentTrack!.file)
            );
            if (trackAlbum && newSelectedAlbum?.id !== trackAlbum.id) {
                newSelectedAlbum = trackAlbum;
            }
          }
          
          const finalIsLoading = isStillJustRehydrated && newCurrentTrack ? true : !newCurrentTrack;

          set({ 
            albumsData: data, 
            currentTrack: newCurrentTrack,
            selectedAlbum: newSelectedAlbum,
            isLoading: finalIsLoading 
          });

        } catch (error) {
          console.error('❌ Zustand: Error loading albums:', error);
          if (!(get().justRehydrated && get().currentTrack)) {
            set({ isLoading: false }); 
          }
        }
      },
      setVolume: (newVolume: number[]) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('grup-yorum-volume', newVolume[0].toString());
        }
        set({ volume: newVolume });
      },
      setMobileView: (view: 'albums' | 'tracks') => set({ mobileView: view }),
      setAlbumsData: (data: AlbumsData) => set({ albumsData: data }),
      setSelectedAlbum: (album: Album) => {
        set({ selectedAlbum: album });
      },
      setCurrentTrack: (track: Track, autoPlay: boolean = true) => {
        const currentTrackFile = get().currentTrack?.file;
        const isCurrentlyPlaying = get().isPlaying;

        if (currentTrackFile === track.file) {
          if (isCurrentlyPlaying && !autoPlay) { 
              get().togglePlay(); 
          } else if (!isCurrentlyPlaying && autoPlay) { 
              get().togglePlay();
          }
          return;
        }
        
        set({ 
          currentTrack: track, 
          shouldAutoPlay: autoPlay, 
          isPlaying: false, 
          isLoading: true 
        });

        const albums = get().albumsData?.albums;
        if (albums) {
            const trackAlbum = albums.find(a =>
                a.tracks.some(t => t.file === track.file)
            );
            if (trackAlbum && (trackAlbum.id !== get().selectedAlbum?.id || !get().selectedAlbum)) {
                set({ selectedAlbum: trackAlbum });
            }
        }
      },
      togglePlay: () => {
        if (!get().currentTrack) {
          return;
        }
        const newIsPlaying = !get().isPlaying;
        set({ 
          isPlaying: newIsPlaying,
          isLoading: newIsPlaying ? true : false,
          shouldAutoPlay: newIsPlaying ? true : get().shouldAutoPlay
        }); 
      },
      setIsLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
      setShouldAutoPlay: (autoPlay: boolean) => {
        set({ shouldAutoPlay: autoPlay });
      },
      setIsPlaying: (playing: boolean) => {
        set({
          isPlaying: playing,
        });
      },
      setCurrentTime: (time: number) => {
        if (Math.abs(get().currentTime - time) > 0.001 || time === 0) {
          set({ currentTime: time });
        }
      },
      setDuration: (duration: number) => set({ duration: duration }),
      handleProgressChange: (newTime: number) => {
        set({ currentTime: newTime }); 
      },
      playNextTrack: () => {
        const { currentTrack, albumsData, setCurrentTrack: setCurrentTrackAction } = get();
        if (!albumsData || !currentTrack) return;

        let playingAlbum = albumsData.albums.find(album => 
            album.tracks.some(track => track.file === currentTrack.file)
        );

        if (!playingAlbum) {
            console.warn("PlayerStore: Couldn't find album for current track to play next.");
            return;
        }

        const currentIndex = playingAlbum.tracks.findIndex(t => t.file === currentTrack.file);
        if (currentIndex < playingAlbum.tracks.length - 1) {
          const nextTrack = playingAlbum.tracks[currentIndex + 1];
          setCurrentTrackAction(nextTrack, true);
        } else {
          set({isPlaying: false, shouldAutoPlay: false}); 
        }
      },
      playPrevTrack: () => {
        const { currentTrack, albumsData, setCurrentTrack: setCurrentTrackAction } = get();
        if (!albumsData || !currentTrack) return;

        let playingAlbum = albumsData.albums.find(album => 
            album.tracks.some(track => track.file === currentTrack.file)
        );

        if (!playingAlbum) {
            console.warn("PlayerStore: Couldn't find album for current track to play previous.");
            return;
        }

        const currentIndex = playingAlbum.tracks.findIndex(t => t.file === currentTrack.file);
        if (currentIndex > 0) {
          const prevTrack = playingAlbum.tracks[currentIndex - 1];
          setCurrentTrackAction(prevTrack, true); 
        }
      },
    }),
    {
      name: 'grup-yorum-player-storage',
      storage: createJSONStorage<PersistedPlayerState>(() => localStorage),
      partialize: (state: PlayerState): PersistedPlayerState => ({
        currentTrack: state.currentTrack,
        currentTime: state.currentTime,
        volume: state.volume,
      }),
      onRehydrateStorage: () => {
        console.log('Zustand: Hydration from localStorage is starting/has started.'); 
        return (hydratedState?: PlayerState, error?: unknown) => {
          if (error) {
            console.error('❌ Zustand: An error occurred during rehydration', error);
          } else {
            if (hydratedState?.currentTrack) { 
              hydratedState.setIsPlaying(false);
              hydratedState.setShouldAutoPlay(false);
              hydratedState.setIsLoading(true); 
              hydratedState.setJustRehydrated(true);
            } else if (hydratedState) {
              hydratedState.setIsLoading(false); 
              hydratedState.setJustRehydrated(false);
            }
          }
        };
      },
      onFinishHydration: (state?: PlayerState) => {
        if (state?.setHasHydrated) {
          state.setHasHydrated(true);
        }
      }
    } as PersistOptions<PlayerState, PersistedPlayerState>
  )
);

// Custom state change logger removed for cleaner production/dev code.
// Use Zustand devtools for debugging state changes. 