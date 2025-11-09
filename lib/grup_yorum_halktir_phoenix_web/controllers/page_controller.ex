defmodule GrupYorumHalktirPhoenixWeb.PageController do
  use GrupYorumHalktirPhoenixWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
