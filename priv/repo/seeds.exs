# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     GrupYorumHalktirPhoenix.Repo.insert!(%GrupYorumHalktirPhoenix.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

alias GrupYorumHalktirPhoenix.Music
alias GrupYorumHalktirPhoenix.Repo

# Base URL for Cloudflare R2
r2_base_url = "https://grupyorumr2.mulayim.app"

# Read and parse JSON file
json_path = Path.join([Application.app_dir(:grup_yorum_halktir_phoenix), "priv/static/all_albums_metadata.json"])
json_content = File.read!(json_path)
data = Jason.decode!(json_content)

IO.puts("Loading albums and tracks from JSON...")

# Clear existing data
Repo.delete_all(GrupYorumHalktirPhoenix.Music.Track)
Repo.delete_all(GrupYorumHalktirPhoenix.Music.Album)

# Process each album
Enum.each(data["albums"], fn album_data ->
  # Generate cover URL
  cover_url = "#{r2_base_url}/albums/#{album_data["year"]}-#{album_data["slug"]}/cover.jpg"

  # Create album
  album_attrs = %{
    title: album_data["title"],
    year: album_data["year"],
    slug: album_data["slug"],
    cover_url: cover_url,
    description: Map.get(album_data, "description"),
    track_count: album_data["trackCount"]
  }

  album = Music.Album.changeset(%Music.Album{}, album_attrs) |> Repo.insert!()

  # Process tracks
  Enum.each(album_data["tracks"], fn track_data ->
    # Generate track file URL
    file_url =
      "#{r2_base_url}/albums/#{album_data["year"]}-#{album_data["slug"]}/tracks/#{track_data["file"]}"

    track_attrs = %{
      album_id: album.id,
      track_number: track_data["track"],
      title: track_data["title"],
      file_url: file_url,
      disc: Map.get(track_data, "disc")
    }

    Music.Track.changeset(%Music.Track{}, track_attrs) |> Repo.insert!()
  end)

  IO.puts("Loaded album: #{album.title} (#{album.year}) with #{album.track_count} tracks")
end)

IO.puts("Seeding completed!")
