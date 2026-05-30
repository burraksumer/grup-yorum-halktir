defmodule GrupYorumHalktirPhoenix.SlugTest do
  use ExUnit.Case, async: true

  alias GrupYorumHalktirPhoenix.Slug

  doctest Slug

  describe "slugify/1" do
    test "transliterates dotted capital İ and downcases" do
      assert Slug.slugify("İlle Kavga") == "ille-kavga"
    end

    test "transliterates dotless ı and ç in mixed content" do
      assert Slug.slugify("15 Yıl Seçmeler") == "15-yil-secmeler"
    end

    test "matches existing album-slug style for Sıyrılıp Gelen" do
      assert Slug.slugify("Sıyrılıp Gelen") == "siyrilip-gelen"
    end

    test "transliterates all Turkish letters" do
      assert Slug.slugify("şçıİğöü ŞÇĞÖÜ") == "sciigou-scgou"
    end

    test "strips punctuation and collapses repeated hyphens" do
      assert Slug.slugify("Gel Ki, Şafaklar  Tutuşsun!") == "gel-ki-safaklar-tutussun"
    end

    test "trims leading and trailing separators" do
      assert Slug.slugify("  -Cemo-  ") == "cemo"
    end
  end
end
