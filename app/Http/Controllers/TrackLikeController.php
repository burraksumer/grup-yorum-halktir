<?php

namespace App\Http\Controllers;

use App\Models\TrackLike;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class TrackLikeController extends Controller
{
    /**
     * Display a listing of the user's liked tracks.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $likes = $user->trackLikes()->get(['album_id', 'track_number']);

        return response()->json($likes);
    }

    /**
     * Store a newly created like in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'album_id' => 'required|integer|exists:albums,id',
            'track_number' => 'required|integer',
        ]);

        // Check if the track is already liked
        $existingLike = $user->trackLikes()
            ->where('album_id', $validated['album_id'])
            ->where('track_number', $validated['track_number'])
            ->first();

        if ($existingLike) {
            return response()->json(['message' => 'Track already liked.', 'like' => $existingLike], 200);
        }

        $like = $user->trackLikes()->create([
            'album_id' => $validated['album_id'],
            'track_number' => $validated['track_number'],
        ]);

        return response()->json(['message' => 'Track liked successfully.', 'like' => $like], 201);
    }

    /**
     * Remove the specified like from storage.
     */
    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'album_id' => 'required|integer|exists:albums,id',
            'track_number' => 'required|integer',
        ]);

        $deletedCount = $user->trackLikes()
            ->where('album_id', $validated['album_id'])
            ->where('track_number', $validated['track_number'])
            ->delete();

        if ($deletedCount > 0) {
            return response()->json(['message' => 'Track unliked successfully.'], 200);
        }

        return response()->json(['message' => 'Track not found or not liked by user.'], 404);
    }
}
