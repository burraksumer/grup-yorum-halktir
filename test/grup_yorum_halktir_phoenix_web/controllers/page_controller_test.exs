defmodule GrupYorumHalktirPhoenixWeb.PageControllerTest do
  use GrupYorumHalktirPhoenixWeb.ConnCase

  test "GET / renders the player home page", %{conn: conn} do
    conn = get(conn, ~p"/")
    body = html_response(conn, 200)
    assert body =~ "Grup Yorum Halktır!"
    assert body =~ "Albümler"
  end
end
