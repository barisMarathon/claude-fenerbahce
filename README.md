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
3. `~/.claude/settings.json` dosyasına klasörün yolunu ekle:
   ```json
   "env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\yol\\claude-fenerbahce" }
   ```
4. Claude'u tamamen kapatıp aç.

Fenerbahçe Spor Kulübü ile bir bağlantısı yoktur. Arma ve marş repoda yer almaz; arma çalışırken Wikipedia'dan çekilir.

<!-- Ekran görüntüleri ve videolar buraya eklenecek. -->

---

**English:** A navy-and-yellow theme mod for the Claude desktop app. It shows your crest in the backdrop, five stars that fill as the context window fills, a live Fenerbahçe match card (ESPN, TheSportsDB), and plays your `assets/mars.mp3` while Claude is answering (`/mars` toggles it). Add the folder to `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` and restart. Not affiliated with Fenerbahçe SK; no crest or audio is included. The crest is fetched from [Wikipedia](https://en.wikipedia.org/wiki/File:Fenerbah%C3%A7e.svg) on first start; for the march, add your own `assets/mars.mp3`.
