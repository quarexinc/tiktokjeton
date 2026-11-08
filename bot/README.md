# Tiktok Jetonlu Yayın Bulma botu

VDS üzerinde 7/24 çalışır, sandıklı TikTok canlı yayınlarını **kendisi bulur** ve siteye ekler. Hesap girmen gerekmez.

## Nasıl buluyor

TikTok'ta tüm canlı yayınları listeleyen açık bir servis yok ve aynı anda yüz binlerce yayın var. Bu yüzden bot kartopu yöntemiyle yayılır:

1. **Sıcak ipuçları:** TikTok, bölgedeki başka bir odada büyük hediye ya da etkinlik olunca bütün yayınlara "bu odaya katıl" bildirimi gönderir. Bot bu bildirimlerdeki odaları en öne alır; bunlar sandık çıkma ihtimali en yüksek yayınlardır.
2. **Keşif:** Bağlandığı her yayında şu mesajları okur ve oradaki yayıncıları, açık oda numaralarıyla birlikte keşif havuzuna ekler:
   - PK/battle eşleşmeleri
   - Ortak yayın (co-host) listeleri
   - Saatlik sıralama listeleri
   - Banner'lar

   Bir yayından onlarca yeni yayıncı çıkar. Sıralamalar bölgesel olduğu için bot Türkiye yayınlarından başlarsa ağırlıklı olarak Türkiye'de kalır.
3. **Doğrulama:** Havuzdaki hesapların açık olup olmadığını TikTok'un toplu oda kontrolüyle doğrular (tek istekte 20 oda).
4. **Yoklama:** Canlı olanlara sırayla 2 dakika bağlanır ve sandık olup olmadığına bakar.
5. **Tutma:** Sandık görürse yayını siteye ekler, sandıklar bitene kadar bağlı kalır ve jeton miktarını, sandık sayısını, geri sayımı günceller. Görmezse bağlantıyı kapatıp sıradakine geçer.
6. **Öğrenme:** Sandık görülen hesaplar havuzda öne çıkar ve 6 dakikada bir yoklanır. Diğerleri 25 dakikada bir yoklanır.

Havuz `kesif.db` dosyasında saklanır; bot yeniden başlasa da öğrendiklerini unutmaz.

**İlk tohum:** Botun yayılmaya başlaması için en az bir canlı yayın görmesi gerekir. Bunun için üç kaynak var:
- Sitede daha önce eklenmiş yayınlar (otomatik alınır).
- Admin panelindeki izleme listesi.
- TikTok'un canlı akışı (deneysel; çalışmazsa bot bunu kendisi kapatır).

Hiçbiri yoksa kayıtta uyarı verir. O durumda izleme listesine canlı olan 1-2 hesap yazman yeter.

## Windows VDS kurulumu (önerilen)

1. VDS'e Uzak Masaüstü ile bağlan.
2. Botu indir: https://github.com/quarexinc/tiktokjeton/archive/refs/heads/main.zip
3. ZIP'i aç. İçindeki `bot` klasörünü `C:\tiktokjeton` olarak kopyala. Yol kısa ve boşluksuz olsun.
4. Sitenin admin panelinde **Otomasyon > Anahtar oluştur**'a bas ve anahtarı kopyala.
5. `C:\tiktokjeton\KURULUM.bat` dosyasına sağ tıkla ve **Yönetici olarak çalıştır** de. Kurulum şunları kendisi yapar:
   - Python yoksa indirip kurar.
   - Paketleri kurar.
   - Site adresini ve API anahtarını sorar.
   - Siteye bağlantıyı dener.
   - Botu Windows açılışında kendiliğinden başlayan bir görev olarak kaydedip başlatır.
6. Admin panelinde Otomasyon sekmesinde birkaç dakika içinde **Çalışıyor** yazmalı.

| Dosya | Ne yapar |
| --- | --- |
| `DURUM.bat` | Keşif özetini ve canlı kaydı gösterir |
| `DURDUR.bat` | Botu durdurur |
| `BASLAT.bat` | Botu yeniden başlatır |
| `GUNCELLE.bat` | GitHub'dan son sürümü indirir; ayarları ve keşif havuzunu korur |
| `PENCEREDE-CALISTIR.bat` | Sorun ararken botu ayrıntılı kayıtla görünür pencerede çalıştırır (önce `DURDUR.bat`) |

Bot arka planda (oturum kapalıyken de) çalışır. Çökerse 15 saniye sonra, sunucu yeniden başlarsa 30 saniye sonra kendiliğinden açılır.

## Linux VDS kurulumu

```bash
git clone https://github.com/quarexinc/tiktokjeton.git
cd tiktokjeton/bot
sudo bash kur-linux.sh          # config.json oluşturur
nano config.json                # api_key yapıştır, kaydet
sudo bash kur-linux.sh          # servisi kurar ve başlatır
```

Bot artık sistem servisi olarak çalışır. Çökerse ya da sunucu yeniden başlarsa kendiliğinden açılır.

| İş | Komut |
| --- | --- |
| Canlı kayıt | `journalctl -u tiktokjeton-bot -f` |
| Kayıt dosyası | `tail -f logs/bot.log` |
| Keşif özeti | `.venv/bin/python tiktok_jeton_bot.py --stats` |
| Yeniden başlat | `sudo systemctl restart tiktokjeton-bot` |
| Güncelle | `bash guncelle-linux.sh` |

## Ayarlar (config.json)

| Alan | Varsayılan | Açıklama |
| --- | --- | --- |
| `site_url` | | Sitenin adresi |
| `api_key` | | Admin paneli > Otomasyon'dan alınan bot anahtarı |
| `discovery` | `true` | Otomatik keşif |
| `feed_discovery` | `true` | TikTok canlı akışından tohum çekmeyi dene (deneysel) |
| `seed_usernames` | `[]` | İsteğe bağlı başlangıç hesapları |
| `max_connections` | `40` | Aynı anda en fazla kaç yayına bağlı kalınacağı |
| `probe_seconds` | `120` | Bir yayında sandık için kaç saniye bekleneceği |
| `linger_minutes` | `8` | Sandık bitince yayında kaç dakika daha kalınacağı |
| `start_interval_sec` | `2` | İki bağlantı arasındaki bekleme |
| `probe_cooldown_min` | `25` | Sandık görülmeyen hesabın yeniden yoklanma aralığı |
| `hot_cooldown_min` | `6` | Daha önce sandık görülen hesabın yeniden yoklanma aralığı |
| `pinned_check_sec` | `120` | İzleme listesindeki hesapların kontrol aralığı |
| `pool_max` | `30000` | Havuzda tutulacak en fazla hesap |
| `sign_api_key` | | Euler Stream imza anahtarı (aşağıya bak) |
| `proxy` | | `http://kullanici:sifre@sunucu:port` |

## Kapasite ve sınırlar

- **Her yeni yayın bağlantısı bir imza isteği gerektirir.** TikTokLive kütüphanesi bunun için Euler Stream servisini kullanır; ücretsiz kullanımda saatlik sınır düşüktür. Bot sınıra takılınca kayıtta "istekleri sınırlıyor" yazar ve yavaşlar. Saatte yüzlerce yayın yoklamak için [eulerstream.com](https://www.eulerstream.com) üzerinden bir anahtar alıp `sign_api_key` alanına yaz.
- **TikTok çok sık istek atan IP'leri geçici olarak engelleyebilir.** Kayıtlarda bağlantı hataları artarsa `max_connections` değerini düşür ya da `proxy` kullan.
- **Kaynak kullanımı:** 2 GB RAM'li bir VDS 40 eş zamanlı bağlantı için yeterlidir. Bağlantı başına yaklaşık 10-20 MB gerekir.
