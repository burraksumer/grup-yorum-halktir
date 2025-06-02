<?php

use App\Http\Controllers\TrackLikeController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/likes', [TrackLikeController::class, 'index'])->name('likes.index');
    Route::post('/likes', [TrackLikeController::class, 'store'])->name('likes.store');
    Route::delete('/likes', [TrackLikeController::class, 'destroy'])->name('likes.destroy');
}); 