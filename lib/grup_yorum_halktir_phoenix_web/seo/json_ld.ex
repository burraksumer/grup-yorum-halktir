defmodule GrupYorumHalktirPhoenixWeb.SEO.JsonLd do
  @moduledoc """
  Builds schema.org JSON-LD as plain Elixir maps (NOT pre-encoded strings).

  The root layout is responsible for `Jason.encode!/1` + `Phoenix.HTML.raw/1`
  on whatever `@json_ld` map a page assigns.

  Three public builders, one per page type:

    * `home/1`  -> a `MusicGroup` with a small list of album stubs.
    * `album/2` -> a `MusicAlbum` (with `byArtist` ref + a track `ItemList`).
    * `track/3` -> a `MusicRecording` (with `inAlbum` + `byArtist` refs).

  All builders read the precomputed virtual `track.slug` (built at cache load)
  and `album.slug` / `album.cover_url` / `track.file_url` verbatim — they never
  reslugify and never reconstruct asset URLs.
  """

  alias GrupYorumHalktirPhoenix.Music.Album
  alias GrupYorumHalktirPhoenix.Music.Track

  @site_url "https://grupyorum.mulayim.app"
  @group_name "Grup Yorum"
  @group_genre "Türk Halk Müziği"
  @group_id @site_url <> "/#musicgroup"

  @doc """
  schema.org `MusicGroup` for the home page, listing album stubs only.
  Keeps the payload small (no per-album track expansion).
  """
  @spec home([Album.t()]) :: map()
  def home(albums) do
    %{
      "@context" => "https://schema.org",
      "@type" => "MusicGroup",
      "@id" => @group_id,
      "name" => @group_name,
      "genre" => @group_genre,
      "url" => @site_url <> "/",
      "album" => Enum.map(albums, &album_stub/1)
    }
  end

  @doc """
  schema.org `MusicAlbum` for an album page, with a `byArtist` ref and a track
  `ItemList`.
  """
  @spec album(Album.t(), [Track.t()]) :: map()
  def album(%Album{} = album, tracks) do
    %{
      "@context" => "https://schema.org",
      "@type" => "MusicAlbum",
      "@id" => album_url(album),
      "name" => album.title,
      "url" => album_url(album),
      "byArtist" => artist_ref(),
      "numTracks" => length(tracks),
      "track" => album_track_list(album, tracks)
    }
    |> put_unless_nil("datePublished", year_string(album.year))
    |> put_unless_nil("image", album.cover_url)
    |> put_unless_nil("description", album.description)
  end

  @doc """
  schema.org `MusicRecording` for a track page, with `inAlbum` + `byArtist` refs.
  """
  @spec track(Album.t(), Track.t(), [Track.t()]) :: map()
  def track(%Album{} = album, %Track{} = track, _tracks) do
    %{
      "@context" => "https://schema.org",
      "@type" => "MusicRecording",
      "@id" => track_url(album, track),
      "name" => track.title,
      "url" => track_url(album, track),
      "byArtist" => artist_ref(),
      "inAlbum" => album_stub(album)
    }
    |> put_unless_nil("image", album.cover_url)
    |> put_unless_nil("audio", track.file_url)
    |> put_unless_nil("duration", iso8601_duration(track.duration))
  end

  # --- private helpers ---

  defp artist_ref do
    %{"@type" => "MusicGroup", "@id" => @group_id, "name" => @group_name}
  end

  defp album_stub(%Album{} = album) do
    %{
      "@type" => "MusicAlbum",
      "@id" => album_url(album),
      "name" => album.title,
      "url" => album_url(album)
    }
    |> put_unless_nil("image", album.cover_url)
    |> put_unless_nil("datePublished", year_string(album.year))
  end

  defp album_track_list(%Album{} = album, tracks) do
    %{
      "@type" => "ItemList",
      "numberOfItems" => length(tracks),
      "itemListElement" =>
        tracks
        |> Enum.with_index(1)
        |> Enum.map(fn {track, position} ->
          %{
            "@type" => "ListItem",
            "position" => position,
            "item" => track_recording(album, track)
          }
        end)
    }
  end

  defp track_recording(%Album{} = album, %Track{} = track) do
    %{
      "@type" => "MusicRecording",
      "@id" => track_url(album, track),
      "name" => track.title,
      "url" => track_url(album, track)
    }
    |> put_unless_nil("duration", iso8601_duration(track.duration))
  end

  defp album_url(%Album{slug: slug}), do: @site_url <> "/album/" <> slug

  defp track_url(%Album{} = album, %Track{slug: slug}),
    do: album_url(album) <> "/" <> slug

  defp year_string(nil), do: nil
  defp year_string(year) when is_integer(year), do: Integer.to_string(year)
  defp year_string(year) when is_binary(year), do: year

  @doc false
  # Converts a float/integer number of seconds into an ISO-8601 duration.
  # `245.0 -> "PT4M5S"`, `nil -> nil`.
  @spec iso8601_duration(number() | nil) :: String.t() | nil
  def iso8601_duration(nil), do: nil

  def iso8601_duration(seconds) when is_number(seconds) do
    total = trunc(seconds)
    minutes = div(total, 60)
    secs = rem(total, 60)
    "PT#{minutes}M#{secs}S"
  end

  defp put_unless_nil(map, _key, nil), do: map
  defp put_unless_nil(map, _key, ""), do: map
  defp put_unless_nil(map, _key, []), do: map
  defp put_unless_nil(map, key, value), do: Map.put(map, key, value)
end
