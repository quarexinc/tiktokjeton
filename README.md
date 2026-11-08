# Tiktok Jetonlu Yayın Bulma

Jeton dağıtılan TikTok canlı yayınlarını listeleyen, üyelik anahtarıyla girilen site.

## Özellikler

**Üyeler için**
- Siteye üyelik anahtarıyla giriş (`TJ-XXXX-XXXX-XXXX`)
- Aktif / Yaklaşan / Geçmiş sekmeleri, arama ve sıralama (en yeni, en çok jeton, bitişi yakın)
- Öne çıkan yayınlar altın çerçeveyle en üstte
- Kalan süre çubuğu, canlı geri sayım, 30 sn'de bir otomatik yenileme
- Yeni yayın açılınca sesli bildirim (ve sekme arka plandaysa tarayıcı bildirimi)
- Üyeliğin kalan süresi üst çubukta

**Admin paneli (`/admin`)**
- Genel bakış: aktif yayın/üye sayısı, 14 günlük giriş ve tıklama grafikleri, en çok tıklanan yayınlar, etkinlik kaydı
- Yayınlar: ekle, düzenle, öne çıkar, uzat, bitir, sil; ana sayfada kalma süresi; ileri tarihli yayın; tıklama sayısı
- Anahtarlar: tek seferde 1-200 anahtar üret; giriş hakkı (1, 3, 5... ya da sınırsız); üyelik süresi (gün ya da süresiz); süre ilk girişte ya da hemen başlar; arama, durum filtresi, CSV dışa aktarma; süre uzatma, hak ekleme, girişleri sıfırlama, oturumları kapatma, devre dışı bırakma
- Ayarlar: anahtar zorunluluğu, "Anahtar al" linki, duyuru, geçmiş yayın ayarları, bakım modu
- Hız sınırı: hatalı anahtar denemeleri IP başına sınırlanır

## Ortam değişkenleri
| Değişken | Açıklama |
| --- | --- |
| `ADMIN_KEY` | Admin paneline giriş anahtarı (zorunlu) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel'de Storage > Upstash Redis bağlanınca otomatik eklenir (önerilen) |
| `BLOB_READ_WRITE_TOKEN` | Redis yerine Vercel Blob kullanılacaksa |
| `SESSION_SECRET` | İsteğe bağlı. Üye oturumlarını imzalamak için ayrı gizli anahtar (yoksa ADMIN_KEY kullanılır) |

Depolama bağlı değilse yerel geliştirmede veri `.data/kv.json` dosyasına yazılır.

## Yerelde çalıştırma
```bash
npm install
ADMIN_KEY=deneme npm run dev
```
