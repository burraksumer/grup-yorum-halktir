defmodule GrupYorumHalktirPhoenix.Slug do
  @moduledoc """
  Turkish-aware slug generation.

  Transliterates Turkish letters to their ASCII equivalents *before*
  downcasing (so the dotted/dotless `İ`/`I`/`ı`/`i` distinctions are
  resolved deterministically rather than depending on locale-sensitive
  `String.downcase/1`), then lowercases, replaces spaces with hyphens,
  strips remaining punctuation, and collapses repeated hyphens.

  Matches the existing album-slug style: `"Sıyrılıp Gelen"` -> `"siyrilip-gelen"`.
  """

  @transliterations %{
    "ş" => "s",
    "Ş" => "s",
    "ç" => "c",
    "Ç" => "c",
    "ı" => "i",
    "İ" => "i",
    "I" => "i",
    "i" => "i",
    "ğ" => "g",
    "Ğ" => "g",
    "ö" => "o",
    "Ö" => "o",
    "ü" => "u",
    "Ü" => "u"
  }

  @doc """
  Slugifies a string.

  ## Examples

      iex> GrupYorumHalktirPhoenix.Slug.slugify("İlle Kavga")
      "ille-kavga"

      iex> GrupYorumHalktirPhoenix.Slug.slugify("15 Yıl Seçmeler")
      "15-yil-secmeler"
  """
  @spec slugify(String.t()) :: String.t()
  def slugify(string) when is_binary(string) do
    string
    |> transliterate()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/u, "")
    |> String.replace(~r/[\s_]+/u, "-")
    |> String.replace(~r/-+/, "-")
    |> String.trim("-")
  end

  defp transliterate(string) do
    string
    |> String.graphemes()
    |> Enum.map_join("", fn grapheme -> Map.get(@transliterations, grapheme, grapheme) end)
  end
end
