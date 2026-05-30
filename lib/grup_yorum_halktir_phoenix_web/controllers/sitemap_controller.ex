defmodule GrupYorumHalktirPhoenixWeb.SitemapController do
  @moduledoc """
  Renders a dynamic `sitemap.xml` from the music catalog: the homepage, every
  album page (`/album/:slug`) and every track page (`/album/:slug/:track_slug`),
  all as absolute URLs.
  """

  use GrupYorumHalktirPhoenixWeb, :controller

  alias GrupYorumHalktirPhoenix.Music

  @site_url "https://grupyorum.mulayim.app"

  def index(conn, _params) do
    conn
    |> put_resp_content_type("application/xml")
    |> send_resp(200, build_xml())
  end

  defp build_xml do
    [
      ~s(<?xml version="1.0" encoding="UTF-8"?>\n),
      ~s(<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n),
      url_entry(@site_url <> "/"),
      Enum.map(Music.list_albums(), &album_urls/1),
      "</urlset>\n"
    ]
    |> IO.iodata_to_binary()
  end

  defp album_urls(album) do
    [
      url_entry("#{@site_url}/album/#{album.slug}"),
      album.id
      |> Music.list_tracks_by_album()
      |> Enum.map(fn track ->
        url_entry("#{@site_url}/album/#{album.slug}/#{track.slug}")
      end)
    ]
  end

  defp url_entry(loc) do
    ["  <url><loc>", xml_escape(loc), "</loc></url>\n"]
  end

  defp xml_escape(value) do
    value
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&apos;")
  end
end
