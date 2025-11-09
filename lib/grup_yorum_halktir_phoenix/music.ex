defmodule GrupYorumHalktirPhoenix.Music do
  @moduledoc """
  The Music context for managing albums and tracks.
  """

  import Ecto.Query
  alias GrupYorumHalktirPhoenix.Repo

  alias GrupYorumHalktirPhoenix.Music.Album
  alias GrupYorumHalktirPhoenix.Music.Track
  alias GrupYorumHalktirPhoenix.Music.PlaybackState

  #
  # Schemas
  #

  defmodule Album do
    use Ecto.Schema
    import Ecto.Changeset

    schema "albums" do
      field :title, :string
      field :year, :integer
      field :slug, :string
      field :cover_url, :string
      field :description, :string
      field :track_count, :integer

      has_many :tracks, GrupYorumHalktirPhoenix.Music.Track

      timestamps(type: :utc_datetime)
    end

    @doc false
    def changeset(album, attrs) do
      album
      |> cast(attrs, [:title, :year, :slug, :cover_url, :description, :track_count])
      |> validate_required([:title, :year, :slug, :cover_url, :track_count])
      |> unique_constraint(:slug)
    end
  end

  defmodule Track do
    use Ecto.Schema
    import Ecto.Changeset

    schema "tracks" do
      field :track_number, :integer
      field :title, :string
      field :file_url, :string
      field :disc, :integer
      field :duration, :float

      belongs_to :album, GrupYorumHalktirPhoenix.Music.Album

      timestamps(type: :utc_datetime)
    end

    @doc false
    def changeset(track, attrs) do
      track
      |> cast(attrs, [:track_number, :title, :file_url, :disc, :album_id, :duration])
      |> validate_required([:track_number, :title, :file_url, :album_id])
      |> foreign_key_constraint(:album_id)
      |> validate_number(:duration, greater_than: 0.0)
    end
  end

  defmodule PlaybackState do
    use Ecto.Schema
    import Ecto.Changeset

    schema "playback_states" do
      field :session_id, :string
      field :position, :float
      field :volume, :float
      field :is_playing, :boolean
      field :shuffle_enabled, :boolean

      belongs_to :current_track, GrupYorumHalktirPhoenix.Music.Track

      timestamps(type: :utc_datetime)
    end

    @doc false
    def changeset(playback_state, attrs) do
      playback_state
      |> cast(attrs, [
        :session_id,
        :current_track_id,
        :position,
        :volume,
        :is_playing,
        :shuffle_enabled
      ])
      |> validate_required([:session_id])
      |> validate_number(:volume, greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0)
      |> validate_number(:position, greater_than_or_equal_to: 0.0)
      |> foreign_key_constraint(:current_track_id)
    end
  end

  #
  # Albums
  #

  def list_albums do
    Repo.all(from a in Album, order_by: [asc: a.year])
  end

  def get_album!(id), do: Repo.get!(Album, id)

  def get_album_by_slug!(slug), do: Repo.get_by!(Album, slug: slug)

  #
  # Tracks
  #

  def list_tracks_by_album(album_id) do
    Repo.all(
      from t in Track,
        where: t.album_id == ^album_id,
        order_by: [asc: t.disc, asc: t.track_number],
        preload: :album
    )
  end

  def get_track!(id), do: Repo.get!(Track, id) |> Repo.preload(:album)

  def update_track_duration(track_id, duration) do
    track = Repo.get!(Track, track_id)
    track
    |> Track.changeset(%{duration: duration})
    |> Repo.update()
  end

  def get_next_track(current_track, tracks, shuffle_enabled \\ false, played_track_ids \\ []) do
    if shuffle_enabled do
      # Filter out already played tracks
      available_tracks = Enum.reject(tracks, fn track -> track.id in played_track_ids end)

      # If all tracks have been played, reset and pick from all tracks
      if Enum.empty?(available_tracks) do
        Enum.random(tracks)
      else
        Enum.random(available_tracks)
      end
    else
      find_next_in_list(current_track, tracks)
    end
  end

  def get_previous_track(current_track, tracks, shuffle_enabled \\ false, played_track_ids \\ []) do
    if shuffle_enabled do
      # Filter out already played tracks
      available_tracks = Enum.reject(tracks, fn track -> track.id in played_track_ids end)

      # If all tracks have been played, reset and pick from all tracks
      if Enum.empty?(available_tracks) do
        Enum.random(tracks)
      else
        Enum.random(available_tracks)
      end
    else
      find_previous_in_list(current_track, tracks)
    end
  end

  defp find_next_in_list(current_track, tracks) do
    case Enum.find_index(tracks, fn t -> t.id == current_track.id end) do
      nil -> List.first(tracks)
      idx when idx == length(tracks) - 1 -> List.first(tracks)
      idx -> Enum.at(tracks, idx + 1)
    end
  end

  defp find_previous_in_list(current_track, tracks) do
    case Enum.find_index(tracks, fn t -> t.id == current_track.id end) do
      nil -> List.last(tracks)
      0 -> List.last(tracks)
      idx -> Enum.at(tracks, idx - 1)
    end
  end

  #
  # Playback States
  #

  def get_or_create_playback_state(session_id) do
    case Repo.get_by(PlaybackState, session_id: session_id) do
      nil ->
        %PlaybackState{
          session_id: session_id,
          volume: 1.0,
          position: 0.0,
          is_playing: false,
          shuffle_enabled: false
        }
        |> Repo.insert!()
        |> Repo.preload(:current_track)

      state ->
        Repo.preload(state, :current_track)
    end
  end

  def update_playback_state(session_id, attrs) do
    case Repo.get_by(PlaybackState, session_id: session_id) do
      nil ->
        %PlaybackState{session_id: session_id}
        |> PlaybackState.changeset(attrs)
        |> Repo.insert()

      state ->
        state
        |> PlaybackState.changeset(attrs)
        |> Repo.update()
    end
  end
end
