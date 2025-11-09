defmodule GrupYorumHalktirPhoenix.Repo.Migrations.AddDurationToTracks do
  use Ecto.Migration

  def change do
    alter table(:tracks) do
      add :duration, :float
    end

    create index(:tracks, [:duration])
  end
end
