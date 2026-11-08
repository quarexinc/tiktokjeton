# Tiktok Jetonlu Yayın Bulma botu

İzleme listesindeki TikTok hesaplarını takip eder. Hesap canlı yayına girince bağlanır, yayında sandık (jeton kutusu) açılınca jeton miktarı, sandık sayısı, sonraki sandığın açılma zamanı ve yayın linkiyle birlikte siteye otomatik ekler. Yayın kapanınca siteden kaldırır.

## Kurulum

1. Python 3.10 ya da üstünü kur (Windows'ta kurulumda **Add Python to PATH** kutusunu işaretle).
2. Bu klasörü bilgisayarına indir.
3. Sitenin admin panelinde **Otomasyon** sekmesine gir, **Anahtar oluştur** de ve anahtarı kopyala.
4. `config.example.json` dosyasını `config.json` adıyla kopyala, `api_key` alanına anahtarı yapıştır.
5. Başlat:
   - Windows: `baslat.bat` dosyasına çift tıkla.
   - macOS / Linux: `./baslat.sh`
   - Elle: `pip install -r requirements.txt` ve `python tiktok_jeton_bot.py`

Bağlantıyı denemek için: `python tiktok_jeton_bot.py --test`
Tek bir hesabı denemek için: `python tiktok_jeton_bot.py --check kullaniciadi`

## İzleme listesi

Takip edilecek hesapları admin panelindeki **Otomasyon > İzleme listesi** bölümünden ekle. Bot listeyi her dakika siteden alır, yeniden başlatmana gerek yok. İstersen `config.json` içindeki `extra_usernames` alanına da hesap yazabilirsin.

## Ayarlar (config.json)

| Alan | Açıklama |
| --- | --- |
| `site_url` | Sitenin adresi |
| `api_key` | Admin panelinden aldığın bot anahtarı |
| `extra_usernames` | Site listesine ek olarak izlenecek hesaplar |
| `check_interval_sec` | Kapalı hesapların kaç saniyede bir kontrol edileceği (en az 30) |
| `max_connections` | Aynı anda en fazla kaç yayına bağlanılacağı |
| `heartbeat_sec` | Siteye durum bildirme ve listeyi yenileme aralığı |
| `keepalive_sec` | Sandık varken sitedeki yayını yenileme aralığı |
| `sign_api_key` | İsteğe bağlı. Çok hesap izliyorsan Euler Stream imza anahtarı (TikTokLive kütüphanesinin kullandığı servis) |
| `proxy` | İsteğe bağlı. `http://kullanici:sifre@sunucu:port` |

## Notlar

- TikTok canlı yayınları için resmî bir arama servisi yok; bot bu yüzden yalnızca listedeki hesapları takip eder.
- Çok sayıda hesabı sık kontrol etmek TikTok tarafından geçici engellemeye yol açabilir. Liste büyükse `check_interval_sec` değerini artır ya da proxy kullan.
- Botun bilgisayarı açık ve internete bağlı olduğu sürece çalışır. 7/24 çalışması için bir VPS'te çalıştırabilirsin.
