defmodule GrupYorumHalktirPhoenix.MusicCacheTest do
  # Non-async: relies on the shared SQL sandbox connection so the long-running
  # MusicCache GenServer can read rows this test inserts when we call reload/0.
  use GrupYorumHalktirPhoenix.DataCase, async: false

  alias GrupYorumHalktirPhoenix.MusicCache
  alias GrupYorumHalktirPhoenix.Music.{Album, Track}

  setup do
    album =
      Repo.insert!(%Album{
        title: "Çığ",
        year: 1999,
        slug: "cig",
        cover_url: "https://example.com/cover.jpg",
        track_count: 2
      })

    on_exit(fn -> MusicCache.reload() end)

    %{album: album}
  end

  describe "get_track_by_slug!/2" do
    test "resolves a track by {album_slug, track_slug}", %{album: album} do
      Repo.insert!(%Track{
        title: "İlle Kavga",
        track_number: 1,
        file_url: "https://example.com/1.mp3",
        disc: 1,
        album_id: album.id
      })

      MusicCache.reload()

      track = MusicCache.get_track_by_slug!("cig", "ille-kavga")
      assert track.title == "İlle Kavga"
      assert track.slug == "ille-kavga"
    end

    test "raises Ecto.NoResultsError for an unknown slug", %{album: album} do
      Repo.insert!(%Track{
        title: "İlle Kavga",
        track_number: 1,
        file_url: "https://example.com/1.mp3",
        disc: 1,
        album_id: album.id
      })

      MusicCache.reload()

      assert_raise Ecto.NoResultsError, fn ->
        MusicCache.get_track_by_slug!("cig", "no-such-track")
      end

      assert_raise Ecto.NoResultsError, fn ->
        MusicCache.get_track_by_slug!("no-such-album", "ille-kavga")
      end
    end

    test "collision suffixing produces distinct, resolvable slugs", %{album: album} do
      Repo.insert!(%Track{
        title: "Marş",
        track_number: 3,
        file_url: "https://example.com/3.mp3",
        disc: 1,
        album_id: album.id
      })

      Repo.insert!(%Track{
        title: "Marş",
        track_number: 7,
        file_url: "https://example.com/7.mp3",
        disc: 1,
        album_id: album.id
      })

      MusicCache.reload()

      first = MusicCache.get_track_by_slug!("cig", "mars-3")
      second = MusicCache.get_track_by_slug!("cig", "mars-7")

      assert first.track_number == 3
      assert second.track_number == 7
      assert first.id != second.id

      # The bare colliding slug must NOT resolve to either track.
      assert_raise Ecto.NoResultsError, fn ->
        MusicCache.get_track_by_slug!("cig", "mars")
      end
    end

    test "non-colliding track keeps its bare slug (no suffix)", %{album: album} do
      Repo.insert!(%Track{
        title: "Marş",
        track_number: 3,
        file_url: "https://example.com/3.mp3",
        disc: 1,
        album_id: album.id
      })

      Repo.insert!(%Track{
        title: "Türkü",
        track_number: 4,
        file_url: "https://example.com/4.mp3",
        disc: 1,
        album_id: album.id
      })

      MusicCache.reload()

      assert MusicCache.get_track_by_slug!("cig", "mars").track_number == 3
      assert MusicCache.get_track_by_slug!("cig", "turku").track_number == 4
    end
  end
end
