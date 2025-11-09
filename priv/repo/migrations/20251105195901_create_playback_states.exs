defmodule GrupYorumHalktirPhoenix.Repo.Migrations.CreatePlaybackStates do
  use Ecto.Migration

  def change do
    create table(:playback_states) do
      add :session_id, :string, null: false
      add :current_track_id, references(:tracks, on_delete: :nilify_all)
      add :position, :float, default: 0.0
      add :volume, :float, default: 1.0
      add :is_playing, :boolean, default: false
      add :shuffle_enabled, :boolean, default: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:playback_states, [:session_id])
    create index(:playback_states, [:current_track_id])
  end
end
