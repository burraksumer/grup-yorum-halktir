# Script to migrate existing MinIO URLs to R2 URLs
# Run with: mix run priv/repo/migrate_to_r2.exs

alias GrupYorumHalktirPhoenix.Music
alias GrupYorumHalktirPhoenix.Repo
import Ecto.Query

IO.puts("Migrating MinIO URLs to R2 URLs...")

# Update album cover URLs
minio_base = "https://minio.mulayim.app/grup-yorum"
r2_base = "https://grupyorumr2.mulayim.app"

albums =
  Repo.all(from(a in Music.Album, where: like(a.cover_url, ^"#{minio_base}%")))

albums_updated =
  Enum.reduce(albums, 0, fn album, acc ->
    new_cover_url = String.replace(album.cover_url, minio_base, r2_base)

    album
    |> Music.Album.changeset(%{cover_url: new_cover_url})
    |> Repo.update!()

    acc + 1
  end)

IO.puts("Updated #{albums_updated} album cover URLs")

# Update track file URLs
tracks =
  Repo.all(from(t in Music.Track, where: like(t.file_url, ^"#{minio_base}%")))

tracks_updated =
  Enum.reduce(tracks, 0, fn track, acc ->
    new_file_url = String.replace(track.file_url, minio_base, r2_base)

    track
    |> Music.Track.changeset(%{file_url: new_file_url})
    |> Repo.update!()

    acc + 1
  end)

IO.puts("Updated #{tracks_updated} track file URLs")

IO.puts("Migration completed!")
