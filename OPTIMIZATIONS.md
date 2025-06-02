# Potential Future Optimizations Plan

This document outlines potential areas for future optimization and refactoring as the application grows or requirements evolve. These are not urgent fixes but rather points to consider for the long-term health and scalability of the application.

## 1. `index.tsx` Component & Hook Refactoring

*   **Custom Hooks for Audio Logic:** The `useEffect` hooks in `index.tsx` managing the audio element (source setting, play/pause, event listeners) are substantial.
    *   **Potential Optimization:** Extract this logic into one or more custom hooks (e.g., `useAudioPlayerManagement(audioRef, storeActions)`). This would reduce the size of `index.tsx`, making the audio management logic more reusable and testable.
*   **Separation of Concerns for UI Logic:**
    *   **Potential Optimization:** If the `Index` component grows with more UI-specific states/effects not directly related to the core player, consider breaking down its JSX or related logic into smaller, focused sub-components.

## 2. State Management (`playerStore.ts`)

*   **Action Granularity vs. Orchestration:**
    *   **Potential Optimization:** Review if sequences of actions always called together could be orchestrated by a single, higher-level action to simplify component logic. The current level seems reasonable, but monitor as complexity grows.
*   **Derived State:**
    *   **Potential Optimization:** Continuously ensure that any state derivable efficiently from other state isn't stored and updated manually. (e.g., `playingAlbum` in `index.tsx` is a good example of current derived state using `useMemo`).

## 3. Performance Considerations

*   **Memoization (`useCallback`, `useMemo`):**
    *   **Potential Optimization:** Periodically review dependencies of these hooks to ensure they are minimal and correct, preventing unnecessary re-renders. Profile with React DevTools if performance issues arise.
*   **Selector Optimization (Zustand):**
    *   **Potential Optimization:** For selectors returning objects/arrays, if components re-render unexpectedly, ensure selection of primitive values or use `shallow` equality checking with `usePlayerStore`.

## 4. Event Handling in `index.tsx`

*   **Consolidation/Abstraction:** The `useEffect` hook for audio event listeners is long.
    *   **Potential Optimization:** Abstracting this into a custom hook (see point 1) would improve clarity. Ensure clear mapping of event names and handlers.

## 5. Advanced Error Handling & User Feedback

*   **Player Errors:** Current `handleError` in `index.tsx` logs to console.
    *   **Potential Optimization:** Implement user-facing error feedback (e.g., toast notifications, error boundary) for issues like track loading failures or playback errors.
*   **Network Issues for Album Fetching:** `fetchAlbumsAndSetInitialTrack` in `playerStore.ts`.
    *   **Potential Optimization:** Communicate fetch failures to the UI, allowing for retries or more informative messages.

## 6. Code Structure and Modularity

*   **Constants:**
    *   **Potential Optimization:** Define string literals (e.g., localStorage keys like `'grup-yorum-player-storage'`) as constants in a shared location to prevent typos and improve maintainability.
*   **Directory Structure:**
    *   **Potential Optimization:** As the app grows, evaluate if further sub-grouping within `resources/js/components/app` or `resources/js/hooks` is beneficial.

## 7. Testing Strategy

*   **Potential Focus Areas for Future Tests:**
    *   **Zustand Store Actions:** Unit test logic in actions like `fetchAlbumsAndSetInitialTrack`, `setCurrentTrack`, `playNextTrack`, `playPrevTrack`, and rehydration.
    *   **Custom Hooks (if implemented):** Unit test any custom hooks for audio management.
    *   **Key Components:** Component tests for `PlayerBar`, `AlbumList`, `TrackList` (rendering based on props, interactions).
    *   **Integration Tests:** For user flows like track selection, resume playback, and album navigation. 