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
      justRehydrated: false, // Initialize flag
      
      albumsData: null,
      selectedAlbum: null,
      currentTrack: null,
      isPlaying: false,
      isLoading: true, // Start with loading true until albums are fetched or hydration occurs
      shouldAutoPlay: false,
      currentTime: 0,
      duration: 0,

      // --- Actions ---
      setHasHydrated: (hydrated: boolean) => set({ _hasHydrated: hydrated }),
      setJustRehydrated: (rehydrated: boolean) => set({ justRehydrated: rehydrated }),
      fetchAlbumsAndSetInitialTrack: async () => { 
        console.log('🎵 Zustand: Fetching albums...');
        const { currentTrack: existingCurrentTrack, justRehydrated: isJustRehydrated } = get(); 
        
        if (!existingCurrentTrack && !isJustRehydrated) { // Only set loading if no track AND not in rehydration phase expecting a track
            set({ isLoading: true });
        }

        try {
          const response = await fetch('/all_albums_metadata.json');
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data: AlbumsData = await response.json();
          
          // Re-evaluate currentTrack and selectedAlbum after await, as they might have been set by rehydration
          const { currentTrack: currentTrackAfterFetch, selectedAlbum: selectedAlbumAfterFetch, justRehydrated: isStillJustRehydrated } = get();
          let newCurrentTrack = currentTrackAfterFetch;
          let newSelectedAlbum = selectedAlbumAfterFetch;

          if (!newCurrentTrack && data.albums.length > 0) {
            const firstAlbum = data.albums[0];
            newSelectedAlbum = firstAlbum;
            if (firstAlbum.tracks.length > 0) {
              newCurrentTrack = firstAlbum.tracks[0];
              console.log('🎵 Zustand: Initial album and track set (no persisted/existing track):', firstAlbum.title, newCurrentTrack.title);
            }
          } else if (newCurrentTrack && data.albums.length > 0) {
            const trackAlbum = data.albums.find(album => 
                album.tracks.some(track => track.file === newCurrentTrack!.file)
            );
            if (trackAlbum && newSelectedAlbum?.id !== trackAlbum.id) {
                console.log('🎵 Zustand (Fetch): Aligning selected album for existing/persisted track:', trackAlbum.title);
                newSelectedAlbum = trackAlbum;
            }
          }
          
          // isLoading logic: 
          // - If we are in a state where a track was just rehydrated, loadedmetadata will handle setting isLoading to false.
          // - Otherwise, isLoading is false if we have a newCurrentTrack, true otherwise.
          const finalIsLoading = isStillJustRehydrated && newCurrentTrack ? true : !newCurrentTrack;

          set({ 
            albumsData: data, 
            currentTrack: newCurrentTrack,
            selectedAlbum: newSelectedAlbum,
            isLoading: finalIsLoading 
          });

        } catch (error) {
          console.error('❌ Zustand: Error loading albums:', error);
          // If an error occurs, and we are not in a rehydrated state with a track, set loading to false.
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
        console.log('🎵 Zustand: Album selected for viewing:', album.title);
        set({ selectedAlbum: album });
      },
      setCurrentTrack: (track: Track, autoPlay: boolean = true) => {
        const currentTrackFile = get().currentTrack?.file;
        const isCurrentlyPlaying = get().isPlaying;

        if (currentTrackFile === track.file) {
          console.log('🎵 Zustand: Same track selected.');
          if (isCurrentlyPlaying && !autoPlay) { 
              get().togglePlay(); 
          } else if (!isCurrentlyPlaying && autoPlay) { 
              get().togglePlay();
          } else if (isCurrentlyPlaying && autoPlay) {
            if(!get().shouldAutoPlay) set({ shouldAutoPlay: true });
          }
          return;
        }
        
        console.log('🎵 Zustand: Track selected:', track.title, 'autoPlay:', autoPlay);
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
                console.log('🎵 Zustand: Setting selected album for the new track:', trackAlbum.title);
                set({ selectedAlbum: trackAlbum });
            }
        }
      },
      togglePlay: () => {
        if (!get().currentTrack) {
          console.log('🎵 Zustand: Toggle play ignored, no current track.');
          return;
        }
        const newIsPlaying = !get().isPlaying;
        set({ 
          isPlaying: newIsPlaying,
          isLoading: newIsPlaying ? true : false,
          shouldAutoPlay: newIsPlaying ? true : get().shouldAutoPlay 
        }); 
        console.log(`🎵 Zustand: Toggle play. New isPlaying: ${newIsPlaying}`);
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
          // isLoading is managed by dedicated events/actions like togglePlay,
          // audio events (playing, loadstart, waiting, canplay, error) via setIsLoadingStore
        });
      },
      setCurrentTime: (time: number) => {
        console.log(`🎵 Zustand: setCurrentTime called with: ${time}. Current currentTime: ${get().currentTime}`);
        // Only update if the new time is meaningfully different to avoid excessive re-renders/log spam
        if (Math.abs(get().currentTime - time) > 0.001 || time === 0) {
          set({ currentTime: time });
        } else {
          // console.log(`[Zustand setCurrentTime] Skipped update, time ${time} is too close to ${get().currentTime}`);
        }
      },
      setDuration: (duration: number) => set({ duration: duration }),
      handleProgressChange: (newTime: number) => {
        console.log(`🎵 Zustand: handleProgressChange called with: ${newTime}. Current currentTime: ${get().currentTime}`);
        // Corresponds to user dragging progress bar
        // We expect audioRef.current.currentTime to be set first in index.tsx, then this updates store
        set({ currentTime: newTime }); 
      },
      playNextTrack: () => {
        const { currentTrack, albumsData, setCurrentTrack: setCurrentTrackAction } = get();
        if (!albumsData || !currentTrack) return;

        let playingAlbum = albumsData.albums.find(album => 
            album.tracks.some(track => track.file === currentTrack.file)
        );

        if (!playingAlbum) {
            console.warn("Couldn't find album for current track to play next.");
            return;
        }

        const currentIndex = playingAlbum.tracks.findIndex(t => t.file === currentTrack.file);
        if (currentIndex < playingAlbum.tracks.length - 1) {
          const nextTrack = playingAlbum.tracks[currentIndex + 1];
          console.log('🎵 Zustand: Playing next track:', nextTrack.title);
          setCurrentTrackAction(nextTrack, true);
        } else {
          console.log('🎵 Zustand: Last track in album, stopping playback.');
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
            console.warn("Couldn't find album for current track to play previous.");
            return;
        }

        const currentIndex = playingAlbum.tracks.findIndex(t => t.file === currentTrack.file);
        if (currentIndex > 0) {
          const prevTrack = playingAlbum.tracks[currentIndex - 1];
          console.log('🎵 Zustand: Playing previous track:', prevTrack.title);
          setCurrentTrackAction(prevTrack, true); 
        } else {
            console.log('🎵 Zustand: First track in album, no previous track.');
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
      onRehydrateStorage: (state?: PlayerState) => {
        console.log('🎵 Zustand: Hydration from localStorage has started/is about to start. Initial state for listener:', state);
        return (hydratedState?: PlayerState, error?: unknown) => {
          if (error) {
            console.error('❌ Zustand: An error occurred during rehydration', error);
          } else {
            console.log('✅ Zustand: Rehydration callback executed. Hydrated state:', hydratedState);
            if (hydratedState) {
              if (hydratedState.currentTrack) { 
                console.log('🎵 Zustand (Rehydrate CB): Track rehydrated. Setting states.');
                hydratedState.setIsPlaying(false);
                hydratedState.setShouldAutoPlay(false);
                hydratedState.setIsLoading(true); 
                hydratedState.setJustRehydrated(true);
              } else {
                hydratedState.setIsLoading(false); 
                hydratedState.setJustRehydrated(false);
              }
            }
          }
        };
      },
      onFinishHydration: (state?: PlayerState) => {
        if (state && typeof state.setHasHydrated === 'function') {
          state.setHasHydrated(true);
          console.log('✅ Zustand: Hydration fully finished (onFinishHydration). _hasHydrated set to true.');
        } else {
          console.warn('⚠️ Zustand (onFinishHydration): state or setHasHydrated not available. State:', state);
        }
      }
    } as PersistOptions<PlayerState, PersistedPlayerState>
  )
);

// Log store changes for debugging (optional)
if (process.env.NODE_ENV === 'development') {
  // Store the previous state to compare
  let previousState = usePlayerStore.getState();

  usePlayerStore.subscribe(
    (currentState) => {
      const changedState: Partial<PlayerState> = {};
      let hasChanges = false;
      for (const key in currentState) {
        if (Object.prototype.hasOwnProperty.call(currentState, key)) {
          const typedKey = key as keyof PlayerState;
          if (previousState[typedKey] !== currentState[typedKey]) {
            // For objects/arrays, a shallow compare might not be enough, but good for primitives
            // For functions, this will always show changed if they are re-created, which is normal for actions
            if (typeof currentState[typedKey] !== 'function') {
                changedState[typedKey] = currentState[typedKey] as any;
                hasChanges = true;
            }
          }
        }
      }
      if (hasChanges) {
        console.log('Zustand state changed. Diff (non-function props):', changedState, 'Full new state:', currentState);
      } else {
        // console.log('Zustand state changed (actions or no data change):', currentState);
      }
      previousState = { ...currentState }; // Update previous state for next comparison
    }
  );
} 