import { create } from 'zustand';

// A simple User interface for now, can be expanded based on Laravel's User model
export interface User {
  id: number;
  name: string;
  email: string;
  // Add other relevant fields like email_verified_at if needed
}

export interface LikedTrackData {
  album_id: number;
  track_number: number;
}

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  likedTracks: Set<string>; // Stores unique identifiers like "albumId||trackNumber"
  isLoadingAuth: boolean;
  isLoadingLikes: boolean;
  
  setUser: (user: User | null) => void;
  checkAuthStatus: () => Promise<void>;
  fetchLikedTracks: () => Promise<void>;
  addLikedTrack: (albumId: number, trackNumber: number) => void;
  removeLikedTrack: (albumId: number, trackNumber: number) => void;
  toggleLikeTrack: (albumId: number, trackNumber: number) => Promise<void>;
  setIsLoadingAuth: (loading: boolean) => void;
  setIsLoadingLikes: (loading: boolean) => void;
  logout: () => Promise<void>;
}

const generateTrackKey = (albumId: number, trackNumber: number) => `${albumId}||${trackNumber}`;

export const useUserStore = create<UserState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  likedTracks: new Set<string>(),
  isLoadingAuth: true, // Start with true to check auth on load
  isLoadingLikes: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setIsLoadingAuth: (loading) => set({ isLoadingAuth: loading }),
  setIsLoadingLikes: (loading) => set({ isLoadingLikes: loading }),

  checkAuthStatus: async () => {
    set({ isLoadingAuth: true });
    try {
      const response = await fetch('/api/user', {
        headers: {
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        const userData = await response.json();
        set({ user: userData, isAuthenticated: true, isLoadingAuth: false });
        // After successfully authenticating, fetch liked tracks
        get().fetchLikedTracks(); 
      } else {
        set({ user: null, isAuthenticated: false, isLoadingAuth: false });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      set({ user: null, isAuthenticated: false, isLoadingAuth: false });
    }
  },

  fetchLikedTracks: async () => {
    if (!get().isAuthenticated) {
      set({ likedTracks: new Set<string>(), isLoadingLikes: false });
      return;
    }
    set({ isLoadingLikes: true });
    try {
      const response = await fetch('/api/likes', {
        headers: {
          'Accept': 'application/json',
          // CSRF token is generally not required for GET requests
        },
      });
      if (response.ok) {
        const likedTracksData: LikedTrackData[] = await response.json();
        const newLikedTracks = new Set<string>();
        likedTracksData.forEach(track => newLikedTracks.add(generateTrackKey(track.album_id, track.track_number)));
        set({ likedTracks: newLikedTracks, isLoadingLikes: false });
      } else {
        console.error('Failed to fetch liked tracks:', await response.text());
        set({ isLoadingLikes: false });
      }
    } catch (error) {
      console.error('Error fetching liked tracks:', error);
      set({ isLoadingLikes: false });
    }
  },

  addLikedTrack: (albumId, trackNumber) => {
    set(state => ({
      likedTracks: new Set(state.likedTracks).add(generateTrackKey(albumId, trackNumber))
    }));
  },

  removeLikedTrack: (albumId, trackNumber) => {
    set(state => {
      const newLikedTracks = new Set(state.likedTracks);
      newLikedTracks.delete(generateTrackKey(albumId, trackNumber));
      return { likedTracks: newLikedTracks };
    });
  },

  toggleLikeTrack: async (albumId, trackNumber) => {
    if (!get().isAuthenticated) {
      console.warn('User not authenticated. Cannot like/unlike track.');
      return;
    }

    const trackKey = generateTrackKey(albumId, trackNumber);
    const isCurrentlyLiked = get().likedTracks.has(trackKey);

    // Optimistic update
    if (isCurrentlyLiked) {
      get().removeLikedTrack(albumId, trackNumber);
    } else {
      get().addLikedTrack(albumId, trackNumber);
    }

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
      const response = await fetch('/api/likes', {
        method: isCurrentlyLiked ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': csrfToken 
        },
        body: JSON.stringify({ album_id: albumId, track_number: trackNumber }),
      });

      if (!response.ok) {
        // Revert optimistic update if API call fails
        if (isCurrentlyLiked) {
          get().addLikedTrack(albumId, trackNumber); // Add it back
        } else {
          get().removeLikedTrack(albumId, trackNumber); // Remove it again
        }
        console.error('Failed to toggle like status on server:', await response.text());
      } else {
        // Optional: if server returns updated list of likes, you could re-sync here,
        // but for a simple toggle, the optimistic update should suffice.
      }
    } catch (error) {
      // Revert optimistic update on network error
      if (isCurrentlyLiked) {
        get().addLikedTrack(albumId, trackNumber);
      } else {
        get().removeLikedTrack(albumId, trackNumber);
      }
      console.error('Error toggling like status:', error);
    }
  },
  
  logout: async () => {
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
      await fetch('/logout', { 
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-TOKEN': csrfToken
        }
      });
    } catch (error) {
        console.error('Logout failed:', error);
        // Still proceed to clear client-side state regardless of server logout success
    }
    // Clear client-side authentication state
    set({ user: null, isAuthenticated: false, likedTracks: new Set<string>(), isLoadingAuth: false, isLoadingLikes: false });
  },
})); 