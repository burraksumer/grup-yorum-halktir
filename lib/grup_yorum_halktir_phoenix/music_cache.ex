defmodule GrupYorumHalktirPhoenix.MusicCache do
  @moduledoc """
  Caches static album/track data in `:persistent_term` for lock-free reads.

  Loads everything from the DB at boot. Reads bypass the GenServer entirely;
  the process exists only to serialize the rare mutations (track duration
  writes triggered once per track when the client first reports metadata).
  """

  use GenServer

  import Ecto.Query
  alias GrupYorumHalktirPhoenix.Repo
  alias GrupYorumHalktirPhoenix.Slug
  alias GrupYorumHalktirPhoenix.Music.Album
  alias GrupYorumHalktirPhoenix.Music.Track

  @albums {__MODULE__, :albums}
  @albums_by_id {__MODULE__, :albums_by_id}
  @albums_by_slug {__MODULE__, :albums_by_slug}
  @tracks_by_album {__MODULE__, :tracks_by_album}
  @tracks_by_id {__MODULE__, :tracks_by_id}
  @tracks_by_slug {__MODULE__, :tracks_by_slug}

  # Public read API — no GenServer round-trip.

  def list_albums, do: :persistent_term.get(@albums)

  def get_album!(id) do
    case Map.fetch(:persistent_term.get(@albums_by_id), id) do
      {:ok, album} -> album
      :error -> raise Ecto.NoResultsError, queryable: Album
    end
  end

  def get_album_by_slug!(slug) do
    case Map.fetch(:persistent_term.get(@albums_by_slug), slug) do
      {:ok, album} -> album
      :error -> raise Ecto.NoResultsError, queryable: Album
    end
  end

  def list_tracks_by_album(album_id) do
    Map.get(:persistent_term.get(@tracks_by_album), album_id, [])
  end

  def get_track!(id) do
    case Map.fetch(:persistent_term.get(@tracks_by_id), id) do
      {:ok, track} -> track
      :error -> raise Ecto.NoResultsError, queryable: Track
    end
  end

  def get_track_by_slug!(album_slug, track_slug) do
    case Map.fetch(:persistent_term.get(@tracks_by_slug), {album_slug, track_slug}) do
      {:ok, track} -> track
      :error -> raise Ecto.NoResultsError, queryable: Track
    end
  end

  # Mutations — serialized through the GenServer.

  def put_track_duration(track_id, duration) do
    GenServer.call(__MODULE__, {:put_track_duration, track_id, duration})
  end

  def reload, do: GenServer.call(__MODULE__, :reload)

  # Server

  def start_link(_opts), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)

  @impl true
  def init(_) do
    load_from_db()
    {:ok, nil}
  end

  @impl true
  def handle_call({:put_track_duration, track_id, duration}, _from, state) do
    tracks_by_id = :persistent_term.get(@tracks_by_id)

    case Map.fetch(tracks_by_id, track_id) do
      {:ok, track} ->
        updated = %{track | duration: duration}
        new_by_id = Map.put(tracks_by_id, track_id, updated)

        new_by_album =
          :persistent_term.get(@tracks_by_album)
          |> Map.update(track.album_id, [updated], fn list ->
            Enum.map(list, fn t -> if t.id == track_id, do: updated, else: t end)
          end)

        new_by_slug =
          :persistent_term.get(@tracks_by_slug)
          |> Map.put({updated.album.slug, updated.slug}, updated)

        :persistent_term.put(@tracks_by_id, new_by_id)
        :persistent_term.put(@tracks_by_album, new_by_album)
        :persistent_term.put(@tracks_by_slug, new_by_slug)
        {:reply, :ok, state}

      :error ->
        {:reply, :not_found, state}
    end
  end

  def handle_call(:reload, _from, state) do
    load_from_db()
    {:reply, :ok, state}
  end

  defp load_from_db do
    albums = Repo.all(from a in Album, order_by: [asc: a.year])

    albums_by_id = Map.new(albums, &{&1.id, &1})
    albums_by_slug = Map.new(albums, &{&1.slug, &1})

    tracks =
      Repo.all(
        from t in Track,
          order_by: [asc: t.disc, asc: t.track_number],
          preload: :album
      )
      |> assign_track_slugs()

    tracks_by_album = Enum.group_by(tracks, & &1.album_id)
    tracks_by_id = Map.new(tracks, &{&1.id, &1})
    tracks_by_slug = Map.new(tracks, &{{&1.album.slug, &1.slug}, &1})

    :persistent_term.put(@albums, albums)
    :persistent_term.put(@albums_by_id, albums_by_id)
    :persistent_term.put(@albums_by_slug, albums_by_slug)
    :persistent_term.put(@tracks_by_album, tracks_by_album)
    :persistent_term.put(@tracks_by_id, tracks_by_id)
    :persistent_term.put(@tracks_by_slug, tracks_by_slug)
  end

  # Assigns the virtual `slug` to every track. Slugs are unique *within an
  # album*; when two tracks in the same album slugify to the same base slug,
  # the `-<track_number>` suffix disambiguates them.
  defp assign_track_slugs(tracks) do
    base_slug_counts =
      tracks
      |> Enum.group_by(& &1.album_id, &Slug.slugify(&1.title))
      |> Map.new(fn {album_id, base_slugs} ->
        {album_id, Enum.frequencies(base_slugs)}
      end)

    Enum.map(tracks, fn track ->
      base = Slug.slugify(track.title)
      collides? = Map.get(base_slug_counts[track.album_id], base, 0) > 1
      slug = if collides?, do: "#{base}-#{track.track_number}", else: base
      %{track | slug: slug}
    end)
  end
end
