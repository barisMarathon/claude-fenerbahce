# claude-fenerbahce

Claude masaüstü uygulaması için sarı-lacivert bir tema modu.

## Ne yapar

- **Tema:** Uygulamanın renkleri lacivert ve sarı olur. Arka planda forma çizgileri, stadyum ışıkları ve arma bulunur.
- **5 yıldız:** Armanın üstündeki yıldızlar context penceresi doldukça yanar; her %20'de bir yıldız.
- **Maç kartı:** Solda Fenerbahçe'nin maçı görünür. Maç oynanıyorsa canlı skor ve dakika, maç bitince birkaç saat sonuç, sonra sıradaki maç gösterilir. Süper Lig ve Avrupa kupaları ESPN'den, Türkiye Kupası TheSportsDB'den gelir.
- **Marş:** Claude cevap yazarken `assets/mars.mp3` çalar, cevap bitince durur. `/mars` komutu sesi kapatıp açar.

## Kurulum

1. Repoyu klonla.
2. Marş için kendi `mars.mp3` dosyanı `assets/` klasörüne koy (isteğe bağlı). Arma için bir şey yapman gerekmez: ilk açılışta [Wikipedia'daki dosyadan](https://en.wikipedia.org/wiki/File:Fenerbah%C3%A7e.svg) otomatik çekilir. Ayrıntılar: [assets/README.md](assets/README.md).
3. `~/.claude/settings.json` dosyasına klasörün tam yolunu ekle:
   - Windows:
     ```json
     "env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\yol\\claude-fenerbahce" }
     ```
   - Linux ve macOS:
     ```json
     "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/home/kullanici/yol/claude-fenerbahce" }
     ```
   Birden fazla klasör yazacaksan Windows'ta `;`, Linux ve macOS'ta `:` ile ayır.
4. **Yalnızca Linux:** Marşı çalmak için `ffplay` (ffmpeg paketinde gelir) ya da `mpv` kurulu olmalı. Örneğin Ubuntu ve Debian'da:
   ```bash
   sudo apt install ffmpeg
   ```
   Windows'ta ve macOS'ta ek bir şey gerekmez.
5. Claude'u tamamen kapatıp aç.

Linux büyük-küçük harfe duyarlıdır: dosya adları tam olarak `mars.mp3` ve `crest.svg` olmalı (`Mars.MP3` bulunmaz).

Fenerbahçe Spor Kulübü ile bir bağlantısı yoktur. Arma ve marş repoda yer almaz; arma çalışırken Wikipedia'dan çekilir.

<!-- Ekran görüntüleri ve videolar buraya eklenecek. -->

---

**English:** A navy-and-yellow theme mod for the Claude desktop app. It shows your crest in the backdrop, five stars that fill as the context window fills, a live Fenerbahçe match card (ESPN, TheSportsDB), and plays your `assets/mars.mp3` while Claude is answering (`/mars` toggles it). Add the folder's full path to `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` (a Windows path such as `C:\\path\\claude-fenerbahce`, or `/home/you/path/claude-fenerbahce` on Linux and macOS; several folders are separated by `;` on Windows and `:` elsewhere) and restart. Works on Windows, macOS and Linux; on Linux the march needs `ffplay` (from ffmpeg) or `mpv`, e.g. `sudo apt install ffmpeg`, and file names are case-sensitive. Not affiliated with Fenerbahçe SK; no crest or audio is included. The crest is fetched from [Wikipedia](https://en.wikipedia.org/wiki/File:Fenerbah%C3%A7e.svg) on first start; for the march, add your own `assets/mars.mp3`.
