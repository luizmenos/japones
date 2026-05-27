# japones
Repo criado para estudar japonês com um site totalmente vibecodado, o foco é o estudo e a memorização dos kanjis, katakanas, hiraganas e frases úteis pro dia a dia

## Áudio

O site toca arquivos MP3 quando o card tem o campo `audio` no JSON. Se não tiver arquivo, ele cai no WebSpeech do navegador.

Os MP3s são cacheados por um service worker depois do primeiro carregamento. Se mudar muitos arquivos e quiser forçar cache novo, altere o `CACHE_VERSION` em `sw.js`.

Para gerar áudios com `edge-tts`:

```bash
pip3 install edge-tts
node scripts/generate-audio.mjs --only=phrases --limit=10
```

Gerar tudo:

```bash
node scripts/generate-audio.mjs
```

Voz padrão: `ja-JP-NanamiNeural`. Dá para trocar:

```bash
node scripts/generate-audio.mjs --voice=ja-JP-KeitaNeural --only=words,phrases
```
