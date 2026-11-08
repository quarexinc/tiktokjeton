# Tiktok Jetonlu Yayın Bulma

Jeton dağıtılan TikTok canlı yayınlarını listeleyen site. Yayınlar ve linkler `/admin` panelinden eklenir; her yayının ana sayfada ne kadar kalacağı panelden ayarlanır, süresi dolan yayın otomatik olarak **Geçmiş** sekmesine geçer.

## Özellikler
- Animasyonlu açılış (3B dönen jeton), Aktif / Yaklaşan / Geçmiş sekmeleri
- Kalan süre çubuğu ve canlı geri sayım, sayfa 30 sn'de bir kendini yeniler
- Admin paneli: anahtar ile giriş, yayın ekle / düzenle / uzat / bitir / sil, ileri tarihli yayın, duyuru metni, geçmiş ayarları
- Veri Upstash Redis'te (ya da Vercel Blob'da) tek bir JSON kaydı olarak tutulur

## Ortam değişkenleri
| Değişken | Açıklama |
| --- | --- |
| `ADMIN_KEY` | Admin paneline giriş anahtarı |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel'de Storage > Upstash Redis bağlanınca otomatik eklenir (önerilen) |
| `BLOB_READ_WRITE_TOKEN` | Redis yerine Vercel Blob kullanılacaksa otomatik eklenir |
| `BLOB_ACCESS` | İsteğe bağlı. Blob deposu "public" ise `public` yaz (varsayılan `private`) |

Hiç depolama bağlı değilse yerel geliştirmede veri `.data/db.json` dosyasına yazılır.

## Yerelde çalıştırma
```bash
npm install
ADMIN_KEY=deneme npm run dev
```
