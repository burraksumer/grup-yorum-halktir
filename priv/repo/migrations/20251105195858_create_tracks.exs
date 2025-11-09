defmodule GrupYorumHalktirPhoenix.Repo.Migrations.CreateTracks do
  use Ecto.Migration

  def change do
    create table(:tracks) do
      add :album_id, references(:albums, on_delete: :delete_all), null: false
      add :track_number, :integer, null: false
      add :title, :string, null: false
      add :file_url, :string, null: false
      add :disc, :integer

      timestamps(type: :utc_datetime)
    end

    create index(:tracks, [:album_id])
    create index(:tracks, [:track_number])
  end
end
