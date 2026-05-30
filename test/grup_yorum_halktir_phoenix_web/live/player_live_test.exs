defmodule GrupYorumHalktirPhoenixWeb.PlayerLiveTest do
  # Non-async: relies on the shared SQL sandbox so the long-running MusicCache
  # GenServer can read rows inserted here after we call reload/0.
  use GrupYorumHalktirPhoenixWeb.ConnCase, async: false

  import Phoenix.LiveViewTest

  alias GrupYorumHalktirPhoenix.Music
  alias GrupYorumHalktirPhoenix.MusicCache
  alias GrupYorumHalktirPhoenix.Music.{Album, Track}
  alias GrupYorumHalktirPhoenix.Repo

  setup do
    album =
      Repo.insert!(%Album{
        title: "Cesaret",
        year: 1992,
        slug: "cesaret",
        cover_url: "https://example.com/cover.jpg",
        track_count: 1
      })

    track =
      Repo.insert!(%Track{
        title: "Dağlara Gel",
        track_number: 1,
        file_url: "https://example.com/daglara-gel.mp3",
        disc: 1,
        album_id: album.id
      })

    MusicCache.reload()
    on_exit(fn -> MusicCache.reload() end)

    %{album: album, track: track}
  end

  describe "unknown URL handling (bug 1: redirect instead of 404)" do
    test "redirects an unknown album slug to the home page", %{conn: conn} do
      conn = get(conn, ~p"/album/no-such-album")
      assert redirected_to(conn) == ~p"/"
    end

    test "redirects an unknown track slug to the home page", %{conn: conn} do
      conn = get(conn, ~p"/album/cesaret/no-such-track")
      assert redirected_to(conn) == ~p"/"
    end

    test "still serves a real album page", %{conn: conn} do
      conn = get(conn, ~p"/album/cesaret")
      assert html_response(conn, 200) =~ "Cesaret"
    end
  end

  describe "click-to-play (bug 2: navigating to a track plays it)" do
    test "navigating to a track after the page is interactive starts playback", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/")

      # The JS hook fires this on connect; it marks the page interactive.
      render_hook(view, "set-session-id", %{"session_id" => "test-session"})

      # Simulate the user clicking a track row (a patch link).
      render_patch(view, ~p"/album/cesaret/daglara-gel")

      assert_push_event(view, "play", %{})
    end

    test "deep-linking a track on initial load cues it without autoplaying", %{conn: conn} do
      {:ok, _view, html} = live(conn, ~p"/album/cesaret/daglara-gel")

      # Track is selected/cued...
      assert html =~ "Dağlara Gel"
      # ...but the player is paused (no autoplay without a user gesture).
      assert html =~ ~s(aria-label="Play")
      refute html =~ ~s(aria-label="Pause")
    end
  end

  describe "navigation during playback (bug: changing album stops the player)" do
    test "browsing to another album keeps the current track playing", %{conn: conn} do
      other =
        Repo.insert!(%Album{
          title: "İlle Kavga",
          year: 2017,
          slug: "ille-kavga",
          cover_url: "https://example.com/ille.jpg",
          track_count: 1
        })

      Repo.insert!(%Track{
        title: "Beat",
        track_number: 1,
        file_url: "https://example.com/beat.mp3",
        disc: 1,
        album_id: other.id
      })

      MusicCache.reload()

      {:ok, view, _html} = live(conn, ~p"/")
      render_hook(view, "set-session-id", %{"session_id" => "test-session"})

      # Start playing a track in the first album.
      render_patch(view, ~p"/album/cesaret/daglara-gel")

      # Now browse to a DIFFERENT album while it is playing.
      html = render_patch(view, ~p"/album/ille-kavga")

      # The browsed album's tracks show up...
      assert html =~ "Beat"
      # ...but the playing track is preserved: the <audio> is still sourced to it
      # and the player still shows the playing (pause) state.
      assert html =~ "daglara-gel.mp3"
      assert html =~ ~s(aria-label="Pause")
    end
  end

  describe "playback position restore on refresh" do
    test "restores the saved position when refreshing a track URL", %{conn: conn, track: track} do
      # A previous session left this track paused at 80s.
      session_id = "restore-session"
      Music.get_or_create_playback_state(session_id)
      Music.update_playback_state(session_id, %{current_track_id: track.id, position: 80.0})

      # Refresh = fresh load of the track URL (deep link), then JS reports the
      # stable session id from localStorage.
      {:ok, view, _html} = live(conn, ~p"/album/cesaret/daglara-gel")
      render_hook(view, "set-session-id", %{"session_id" => session_id})

      # The audio must seek to the saved position, not restart at 0.
      assert_push_event(view, "seek", %{position: 80.0})
    end
  end
end
