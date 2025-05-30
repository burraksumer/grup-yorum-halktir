# PowerShell Script - Grup Yorum Albüm Organizasyonu
# Bu script all_albums_metadata.json dosyasını kullanarak albümleri organize eder

Write-Host "=== Grup Yorum Albüm Organizasyon Başlıyor ===" -ForegroundColor Cyan

# Kaynak ve hedef klasörler
$sourceDir = "C:\Users\Burak\Downloads\Grup Yorum"
$projectRoot = $PSScriptRoot
$publicDir = Join-Path $projectRoot "public"
$albumsDir = Join-Path $publicDir "albums"
$metadataFile = Join-Path $projectRoot "all_albums_metadata.json"

Write-Host "Kaynak klasör: $sourceDir" -ForegroundColor Yellow
Write-Host "Hedef klasör: $albumsDir" -ForegroundColor Yellow

# Klasörleri oluştur
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
New-Item -ItemType Directory -Force -Path $albumsDir | Out-Null

# Kaynak klasör mapping (metadata slug -> gerçek klasör adı)
$sourceMapping = @{
    "siyrilip-gelen" = "1-SIYRILIP GELEN"
    "haziranda-olmek-zor" = "2-HAZIRANDA OLMEK ZOR"
    "turkularla" = "3-TÜRKÜLERLE"
    "cemo" = "4-CEMO"
    "gel-ki-safaklar-tutussun" = "5-GELKI SAFAKLAR TUTUSSSUN"
    "yurek-cagrisi" = "6-YÜREK ÇAĞRISI"
    "cesaret" = "7-CESARET"
    "hic-durmadan" = "8-HIC DURMADAN"
    "ileri" = "9-ILERI"
    "geliyoruz" = "10-GELIYORUZ"
    "marslarimiz" = "11-MARSLARIMIZ"
    "boran-firtinasi" = "12-BORAN FIRTINASI"
    "15-yil-secmeler" = "13-15.YIL SEÇMELER"
    "kucaklasma" = "14-KUCAKLAŞMA"
    "eylul" = "15-EYLÜL"
    "feda" = "16-FEDA"
    "biz-variz" = "17-BİZ VARIZ"
    "yuruyus" = "18-YÜRÜYÜŞ"
    "yildizlar-kusandik" = "19-YILDIZLAR KUŞANDIK"
    "basegmeden" = "20-BAŞEĞMEDEN"
    "halkin-elleri" = "21-HALKIN ELLERİ"
    "ruhi-su" = "22-RUHİ SU"
    "ille-kavga" = "23-İLLE KAVGA"
}

# Metadata dosyasını oku
if (-not (Test-Path $metadataFile)) {
    Write-Error "Metadata dosyası bulunamadı: $metadataFile"
    exit 1
}

$metadata = Get-Content $metadataFile -Raw | ConvertFrom-Json
Write-Host "Toplam albüm sayısı: $($metadata.albums.Count)" -ForegroundColor Green

$processedCount = 0
$errorCount = 0

foreach ($album in $metadata.albums) {
    Write-Host "`n➤ İşleniyor: $($album.title) ($($album.year))" -ForegroundColor Yellow
    
    # Yıl bilgisini içeren klasör adı oluştur
    $albumSlugWithYear = "$($album.year)-$($album.slug)"
    $albumDir = Join-Path $albumsDir $albumSlugWithYear
    $tracksDir = Join-Path $albumDir "tracks"
    
    New-Item -ItemType Directory -Force -Path $albumDir | Out-Null
    New-Item -ItemType Directory -Force -Path $tracksDir | Out-Null
    
    Write-Host "  Klasör: $albumSlugWithYear" -ForegroundColor Blue
    
    # Kaynak albüm klasörünü bul
    $sourceAlbumPath = $null
    if ($sourceMapping.ContainsKey($album.slug)) {
        $sourceAlbumPath = Join-Path $sourceDir $sourceMapping[$album.slug]
    }
    
    if (-not $sourceAlbumPath -or -not (Test-Path $sourceAlbumPath)) {
        Write-Warning "  ❌ Kaynak klasör bulunamadı: $($album.slug)"
        $errorCount++
        continue
    }
    
    Write-Host "  Kaynak: $($sourceMapping[$album.slug])" -ForegroundColor Magenta
    
    # Kapak resmini bul ve kopyala
    $coverFound = $false
    $coverPatterns = @("Folder.jpg", "AlbumArtSmall.jpg", "*.jpg", "*.jpeg", "*.png")
    
    foreach ($pattern in $coverPatterns) {
        $coverFiles = Get-ChildItem -Path $sourceAlbumPath -Filter $pattern -File -Recurse -ErrorAction SilentlyContinue | Sort-Object Length -Descending
        if ($coverFiles.Count -gt 0) {
            $selectedCover = $coverFiles[0]
            Copy-Item $selectedCover.FullName (Join-Path $albumDir "cover.jpg") -Force
            Write-Host "  ✓ Kapak: $($selectedCover.Name)" -ForegroundColor Green
            $coverFound = $true
            break
        }
    }
    
    if (-not $coverFound) {
        Write-Host "  ⚠ Kapak bulunamadı" -ForegroundColor Yellow
    }
    
    # MP3 dosyalarını bul
    $mp3Files = @()
    
    # Özel durumlar için farklı arama stratejileri
    if ($album.slug -eq "15-yil-secmeler") {
        # 15. Yıl Seçmeler - 2 CD'li albüm
        $cd1Files = Get-ChildItem -Path (Join-Path $sourceAlbumPath "15.Yil Seçmeler (cd 1)") -Filter "*.mp3" -File | Sort-Object Name
        $cd2Files = Get-ChildItem -Path (Join-Path $sourceAlbumPath "15.Yil Seçmeler (cd 2)") -Filter "*.mp3" -File | Sort-Object Name
        $mp3Files = $cd1Files + $cd2Files
    }
    elseif ($album.slug -eq "ruhi-su") {
        # Ruhi Su - "Grup Yorum - " ile başlayan dosyalar, numaraya göre sırala
        $mp3Files = Get-ChildItem -Path $sourceAlbumPath -Filter "*.mp3" -File | Where-Object { $_.Name -like "*Grup Yorum*" } | Sort-Object { 
            if ($_.Name -match '(\d+)') { [int]$matches[1] } else { 999 }
        }
    }
    elseif ($album.slug -eq "basegmeden") {
        # Başeğmeden - "Grup Yorum - " ile başlayan dosyalar, alfabetik sırala
        $mp3Files = Get-ChildItem -Path $sourceAlbumPath -Filter "*.mp3" -File | Where-Object { $_.Name -like "Grup Yorum*" } | Sort-Object Name
    }
    else {
        # Tüm diğer albümler - dosya isimlerindeki numaraya göre sırala
        $mp3Files = Get-ChildItem -Path $sourceAlbumPath -Filter "*.mp3" -File | Sort-Object { 
            if ($_.Name -match '^(\d+)') { 
                [int]$matches[1] 
            } else { 
                999 # Numarasız dosyalar sona
            }
        }
    }
    
    if ($mp3Files.Count -eq 0) {
        Write-Warning "  ❌ MP3 dosyası bulunamadı"
        $errorCount++
        continue
    }
    
    Write-Host "  Bulunan MP3: $($mp3Files.Count), İhtiyaç: $($album.tracks.Count)" -ForegroundColor Cyan
    
    # Sadece metadata'daki track sayısı kadar dosya al
    $tracksToProcess = [Math]::Min($album.tracks.Count, $mp3Files.Count)
    
    for ($i = 0; $i -lt $tracksToProcess; $i++) {
        $track = $album.tracks[$i]
        $sourceFile = $mp3Files[$i]
        $targetFile = Join-Path $tracksDir $track.file
        
        try {
            Copy-Item $sourceFile.FullName $targetFile -Force
            Write-Host "  ✓ $($track.file)" -ForegroundColor Green
        }
        catch {
            Write-Host "  ❌ Hata: $($track.file)" -ForegroundColor Red
            $errorCount++
        }
    }
    
    # Eksik track uyarısı
    if ($mp3Files.Count -lt $album.tracks.Count) {
        $missingCount = $album.tracks.Count - $mp3Files.Count
        Write-Host "  ⚠ $missingCount track eksik!" -ForegroundColor Yellow
    }
    
    $processedCount++
    Write-Host "  ✅ Tamamlandı ($tracksToProcess/$($album.tracks.Count) track)" -ForegroundColor Green
}

Write-Host "`n=== İŞLEM TAMAMLANDI ===" -ForegroundColor Cyan
Write-Host "İşlenen albüm: $processedCount" -ForegroundColor Green
Write-Host "Hata sayısı: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
Write-Host "Sonuç klasörü: $albumsDir" -ForegroundColor Yellow

# Sonuç özeti
Write-Host "`nKlasör yapısını kontrol edin:" -ForegroundColor Cyan
Get-ChildItem $albumsDir -Directory | Select-Object Name | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White } 