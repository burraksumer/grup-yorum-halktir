defmodule GrupYorumHalktirPhoenix.Release do
  @moduledoc """
  Used for executing DB release tasks when run in production without Mix
  installed.
  """
  @app :grup_yorum_halktir_phoenix

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  def seed do
    load_app()

    # Start the repo before seeding
    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, fn _repo ->
        # Execute the seeds.exs file
        seeds_path = Path.join([Application.app_dir(:grup_yorum_halktir_phoenix), "priv/repo/seeds.exs"])
        Code.eval_file(seeds_path)
        :ok
      end)
    end
  end

  def migrate_to_r2 do
    load_app()

    IO.puts("Migrating MinIO URLs to R2 URLs...")

    minio_base = "https://minio.mulayim.app/grup-yorum"
    r2_base = "https://grupyorumr2.mulayim.app"

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, fn repo ->
        alias GrupYorumHalktirPhoenix.Music
        import Ecto.Query

        # Update album cover URLs
        albums = repo.all(from(a in Music.Album, where: like(a.cover_url, ^"#{minio_base}%")))
        albums_updated = Enum.reduce(albums, 0, fn album, acc ->
          new_cover_url = String.replace(album.cover_url, minio_base, r2_base)
          album |> Music.Album.changeset(%{cover_url: new_cover_url}) |> repo.update!()
          acc + 1
        end)
        IO.puts("Updated #{albums_updated} album cover URLs")

        # Update track file URLs
        tracks = repo.all(from(t in Music.Track, where: like(t.file_url, ^"#{minio_base}%")))
        tracks_updated = Enum.reduce(tracks, 0, fn track, acc ->
          new_file_url = String.replace(track.file_url, minio_base, r2_base)
          track |> Music.Track.changeset(%{file_url: new_file_url}) |> repo.update!()
          acc + 1
        end)
        IO.puts("Updated #{tracks_updated} track file URLs")

        :ok
      end)
    end

    IO.puts("Migration completed!")
  end

  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  defp load_app do
    # Many platforms require SSL when connecting to the database
    Application.ensure_all_started(:ssl)
    Application.ensure_loaded(@app)
  end
end
