defmodule GrupYorumHalktirPhoenix.Repo.Migrations.CreateAlbums do
  use Ecto.Migration

  def change do
    create table(:albums) do
      add :title, :string, null: false
      add :year, :integer, null: false
      add :slug, :string, null: false
      add :cover_url, :string, null: false
      add :description, :text
      add :track_count, :integer, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:albums, [:slug])
    create index(:albums, [:year])
  end
end
