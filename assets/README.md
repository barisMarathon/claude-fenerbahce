# assets

Bu klasöre iki dosyayı kendin koyarsın; git bunları yüklemez:

- `crest.svg`: arka plandaki arma. Yalnızca vektör çizim olmalı: içinde resim, yazı tipi, bağlantı ya da script olmasın.
- `mars.mp3`: cevap beklerken çalan ses.

İkisi de isteğe bağlı. Biri yoksa o kısım atlanır, temanın geri kalanı çalışır.

## Nereden bulunur

- **Arma:** Kendiliğinden gelir. `crest.svg` yoksa mod ilk açılışta Wikipedia'daki [Fenerbahçe.svg](https://en.wikipedia.org/wiki/File:Fenerbah%C3%A7e.svg) dosyasını çeker ve buraya kaydeder. Başka bir arma istersen kendi `crest.svg` dosyanı koyman yeter.
- **Marş:** Kendi kaydını kullan. Elinde video varsa sesini mp3 olarak çıkar:
  ```
  ffmpeg -i mars.mp4 -vn -q:a 4 mars.mp3
  ```

---

Put your own `crest.svg` (pure vector) and `mars.mp3` here. Both are optional and git-ignored. Without a `crest.svg`, the mod fetches it from [Wikipedia](https://en.wikipedia.org/wiki/File:Fenerbah%C3%A7e.svg) on first start and saves it here; for the march, use your own recording (`ffmpeg -i mars.mp4 -vn -q:a 4 mars.mp3`).
