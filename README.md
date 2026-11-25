# Nexa AI — Vercel Edition

Chatbot AI dengan HTML, CSS, JavaScript, Vercel Functions, OpenRouter, dan LocalStorage.

## Struktur

```text
nexa-ai/
├── api/
│   └── chat.js
├── assets/
│   ├── app.js
│   └── style.css
├── lib/
│   └── chat-handler.js
├── server.js
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vercel.json
└── README.md
```

## Jalankan secara lokal

1. Install Node.js versi LTS (minimal versi 18).
2. Jika file `.env` belum ada, salin `.env.example` menjadi `.env`.
3. Isi `OPENROUTER_API_KEY` di `.env` dengan API key milikmu.
4. Dari root proyek, jalankan `npm run dev`.
5. Buka `http://localhost:3000`.

Server lokal mandiri menyajikan halaman dan endpoint `POST /api/chat`, tanpa Vercel CLI. Jangan membuka `index.html` langsung atau memakai Live Server saja karena keduanya tidak menjalankan endpoint chat. Membuka `/api/chat` langsung di browser akan mengirim `GET` dan menghasilkan 405; chat dari halaman Nexa mengirim `POST`.

## Deploy ke Vercel

1. Push folder proyek ke repository GitHub.
2. Masuk ke Vercel dan pilih **Add New → Project**.
3. Import repository Nexa AI.
4. Pada **Settings → Environment Variables**, tambahkan:
   - `OPENROUTER_API_KEY` = API key OpenRouter
   - `OPENROUTER_MODEL` = `openrouter/free`
   - `APP_URL` = URL deployment Vercel (opsional)
5. Deploy atau lakukan Redeploy setelah menambahkan/mengubah environment variables.

Framework Preset dapat menggunakan **Other**. Biarkan Build Command dan Output Directory kosong/default karena proyek ini berupa static files dan Vercel Functions.

## API contract

Frontend mengirim `POST /api/chat`:

```json
{
  "messages": [
    { "role": "user", "content": "Halo!" }
  ]
}
```

API membalas:

```json
{ "reply": "Halo! Ada yang bisa saya bantu?" }
```

## Catatan keamanan dan batasan

- API key hanya dibaca di server melalui `process.env`; jangan masukkan ke frontend.
- `.env` diabaikan Git melalui `.gitignore`. Jangan commit file `.env`.
- Riwayat chat disimpan di LocalStorage browser, bukan database. Riwayat hanya tersedia di browser/perangkat yang sama dan dapat hilang jika data situs dibersihkan.
- `openrouter/free` adalah model router gratis; ketersediaan model dan limit dapat berubah sesuai kebijakan OpenRouter.
- Endpoint ini memiliki validasi dasar dan batas konteks 20 pesan. Untuk penggunaan publik skala besar, tambahkan rate limiting, autentikasi, dan proteksi penyalahgunaan.
