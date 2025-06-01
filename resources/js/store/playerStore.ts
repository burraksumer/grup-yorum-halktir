import { create } from 'zustand';

export interface Track {
  track: number;
  title: string;
  file: string;
  disc?: number;
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

interface PlayerState {
  // Initial simple states
  volume: number[];
  mobileView: 'albums' | 'tracks';

  // Placeholder for other states - will be added progressively
  albumsData: AlbumsData | null;
  selectedAlbum: Album | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  shouldAutoPlay: boolean; // Added for managing auto play behavior

  // --- Actions ---
  fetchAlbumsAndSetInitialTrack: (minioPublicUrl: string) => Promise<void>; // Added for initial data loading
  setVolume: (volume: number[]) => void;
  setMobileView: (view: 'albums' | 'tracks') => void;

  // Placeholder for other actions - will be added progressively
  setAlbumsData: (data: AlbumsData) => void;
  setSelectedAlbum: (album: Album) => void;
  setCurrentTrack: (track: Track, autoPlay?: boolean) => void;
  togglePlay: () => void;
  setIsLoading: (loading: boolean) => void;
  setShouldAutoPlay: (autoPlay: boolean) => void; // Added for managing auto play behavior
  setIsPlaying: (playing: boolean) => void; // Added action to directly set playing state
  playNextTrack: () => void;
  playPrevTrack: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial values
  volume: (typeof window !== 'undefined' && localStorage.getItem('grup-yorum-volume'))
    ? [parseInt(localStorage.getItem('grup-yorum-volume')!, 10)]
    : [75],
  mobileView: 'albums',
  
  // Placeholder initial values - will be refined
  albumsData: null,
  selectedAlbum: null,
  currentTrack: null,
  isPlaying: false,
  isLoading: true, // Set to true initially until albums load
  shouldAutoPlay: false,

  // --- Actions ---
  fetchAlbumsAndSetInitialTrack: async (minioPublicUrl: string) => {
    console.log('🎵 Zustand: Fetching albums and setting initial track...');
    set({ isLoading: true });
    try {
      const response = await fetch('/all_albums_metadata.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: AlbumsData = await response.json();
      set({ albumsData: data });
      if (data.albums.length > 0) {
        const firstAlbum = data.albums[0];
        set({ selectedAlbum: firstAlbum });
        if (firstAlbum.tracks.length > 0) {
          const firstTrack = firstAlbum.tracks[0];
          // Do not autoPlay the very first track on load, just set it.
          // The audio URL will be set by a useEffect in the component based on this currentTrack.
          set({ currentTrack: firstTrack, isLoading: false, shouldAutoPlay: false }); 
          console.log('🎵 Zustand: Initial album and track set:', firstAlbum.title, firstTrack.title);
        } else {
          set({ isLoading: false });
          console.log('🎵 Zustand: First album has no tracks.');
        }
      } else {
        set({ isLoading: false });
        console.log('🎵 Zustand: No albums found in metadata.');
      }
    } catch (error) {
      console.error('❌ Zustand: Error loading albums:', error);
      set({ isLoading: false });
    }
  },
  setVolume: (newVolume) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('grup-yorum-volume', newVolume[0].toString());
      // Note: Updating audioRef.current.volume will be handled in the component via useEffect
    }
    set({ volume: newVolume });
  },
  setMobileView: (view) => set({ mobileView: view }),

  // Placeholder actions - to be implemented
  setAlbumsData: (data) => set({ albumsData: data }),
  setSelectedAlbum: (album) => {
    console.log('🎵 Zustand: Album selected for viewing:', album.title);
    set({ selectedAlbum: album });
    // Optional: if an album is selected for viewing, and no track is current, select its first track?
    // Or if a track is playing from another album, do we stop it or change it?
    // For now, just sets selectedAlbum for viewing. Track selection is separate.
  },
  setCurrentTrack: (track, autoPlay = true) => {
    const currentTrackFile = get().currentTrack?.file;
    const isCurrentlyPlaying = get().isPlaying;

    if (currentTrackFile === track.file) {
      console.log('🎵 Zustand: Same track selected.');
      // If the same track is selected, toggle play/pause
      if (isCurrentlyPlaying && !autoPlay) { // Explicitly don't autoPlay (e.g. user clicked to pause)
          get().togglePlay(); 
      } else if (!isCurrentlyPlaying && autoPlay) { // Explicitly autoPlay (e.g. user clicked to play paused track)
          get().togglePlay();
      } else if (isCurrentlyPlaying && autoPlay) {
        // if it is already playing and autoPlay is true (e.g. from next/prev), ensure it continues
        // No state change needed here if already playing, src will be the same.
        // For safety, ensure shouldAutoPlay is true if it wasn't
        if(!get().shouldAutoPlay) set({ shouldAutoPlay: true });
      }
      return;
    }
    
    console.log('🎵 Zustand: Track selected:', track.title, 'autoPlay:', autoPlay);
    // When a new track is set, it implies it should play if autoPlay is true.
    // isLoading will be set to true, and isPlaying to false until the audio actually starts.
    set({ 
      currentTrack: track, 
      shouldAutoPlay: autoPlay, 
      isPlaying: false, // Will be set to true by audio event 'playing'
      isLoading: true 
    });

    // If the track belongs to an album different from the currently *selected* (for viewing) album,
    // update the selectedAlbum to the track's album.
    const albums = get().albumsData?.albums;
    if (albums) {
        const trackAlbum = albums.find(album =>
            album.tracks.some(t => t.file === track.file)
        );
        // Also update selectedAlbum if no album is selected yet
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
      // If we are now attempting to play, set isLoading to true.
      // The 'playing' event from audio element will set isLoading to false.
      // If we are pausing, isLoading should be false.
      isLoading: newIsPlaying ? true : false,
      // shouldAutoPlay is not directly managed by togglePlay itself.
      // It's a flag for scenarios like track changes or auto-next.
      // However, if user explicitly hits play, we might infer they want it to continue if possible.
      // For now, let togglePlay focus on isPlaying and isLoading for the immediate action.
      // If a track is paused and user hits play, shouldAutoPlay might become relevant if track ends etc.
      // but not for the immediate play/pause action.
      // Let's ensure that if we start playing, shouldAutoPlay becomes true so that if the track ends, next one plays.
      shouldAutoPlay: newIsPlaying ? true : get().shouldAutoPlay // Preserve shouldAutoPlay if pausing, set to true if playing
    }); 
    console.log(`🎵 Zustand: Toggle play. New isPlaying: ${newIsPlaying}`);
  },
  setIsLoading: (loading) => {
    // console.log('🎵 Zustand: setIsLoading:', loading);
    set({ isLoading: loading });
  },
  setShouldAutoPlay: (autoPlay) => {
    // console.log('🎵 Zustand: setShouldAutoPlay:', autoPlay);
    set({ shouldAutoPlay: autoPlay });
  },
  setIsPlaying: (playing) => {
    set(state => ({ 
      isPlaying: playing,
      isLoading: false 
    }));
  },
  playNextTrack: () => {
    const { currentTrack, albumsData } = get();
    if (!albumsData || !currentTrack) return;

    // Determine the album of the current track
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
      get().setCurrentTrack(nextTrack, true); // autoPlay next track
    } else {
      console.log('🎵 Zustand: Last track in album, stopping playback.');
      set({isPlaying: false, shouldAutoPlay: false}); // Stop playing and don't autoPlay further
    }
  },
  playPrevTrack: () => {
    const { currentTrack, albumsData } = get();
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
      get().setCurrentTrack(prevTrack, true); // autoPlay previous track
    } else {
        console.log('🎵 Zustand: First track in album, no previous track.');
    }
  },
}));

// Log store changes for debugging (optional)
if (process.env.NODE_ENV === 'development') {
  usePlayerStore.subscribe(
    (state, prevState) => console.log('Zustand state changed:', { current: state, previous: prevState }),
    // (state) => console.log('Zustand state changed:', state) // Alternative simpler log
  );
} 