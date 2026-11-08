# Tiktok Jetonlu Yayın Bulma

Jeton dağıtılan TikTok canlı yayınlarını listeleyen site. Yayınlar ve linkler `/admin` panelinden eklenir; her yayının ana sayfada ne kadar kalacağı panelden ayarlanır, süresi dolan yayın otomatik olarak **Geçmiş** sekmesine geçer.

## Özellikler
- Animasyonlu açılış (3B dönen jeton), Aktif / Yaklaşan / Geçmiş sekmeleri
- Kalan süre çubuğu ve canlı geri sayım, sayfa 30 sn'de bir kendini yeniler
- Admin paneli: anahtar ile giriş, yayın ekle / düzenle / uzat / bitir / sil, ileri tarihli yayın, duyuru metni, geçmiş ayarları
- Veri Vercel Blob'da tek bir JSON dosyasında tutulur (veritabanı gerekmez)

## Ortam değişkenleri
| Değişken | Açıklama |
| --- | --- |
| `ADMIN_KEY` | Admin paneline giriş anahtarı |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob deposu projeye bağlanınca otomatik eklenir |
| `BLOB_ACCESS` | İsteğe bağlı. Blob deposu "public" ise `public` yaz (varsayılan `private`) |

Blob token'ı yoksa (yerel geliştirme) veri `.data/db.json` dosyasına yazılır.

## Yerelde çalıştırma
```bash
npm install
ADMIN_KEY=deneme npm run dev
```
