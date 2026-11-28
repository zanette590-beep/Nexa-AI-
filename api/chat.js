export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Gunakan POST." });
  }

  try {
    const body = req.body || {};
    const messages = body.messages || [];

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY belum diatur di Vercel." });
    }

    // 1. Ambil daftar model yang diizinkan untuk API key ini
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const modelsData = await modelsRes.json();

    if (!modelsRes.ok) {
      return res.status(modelsRes.status).json({
        error: `Gagal cek model Groq: ${modelsData.error?.message || JSON.stringify(modelsData)}`
      });
    }

    // Filter model yang tersedia (abaikan model suara/audio)
    const availableModels = (modelsData.data || [])
      .map(m => m.id)
      .filter(id => !id.includes('whisper') && !id.includes('guard') && !id.includes('orpheus'));

    if (availableModels.length === 0) {
      return res.status(403).json({
        error: "Tidak ada model teks yang aktif di akun Groq ini. Coba buat API Key baru di console.groq.com."
      });
    }

    // Ambil model pertama yang tersedia di akunmu secara otomatis
    const selectedModel = availableModels[0];

    const formattedMessages = messages.map((msg) => ({
      role: msg.role === 'model' ? 'assistant' : (msg.role || 'user'),
      content: msg.content || ''
    }));

    if (!formattedMessages.some(m => m.role === 'system')) {
      formattedMessages.unshift({
        role: 'system',
        content: 'Kamu adalah Nexa AI, asisten virtual cerdas. Kamu WAJIB menjawab seluruh pertanyaan menggunakan Bahasa Indonesia yang baik, natural, ramah, dan santai.'
      });
    }

    // 2. Kirim pesan menggunakan model yang pasti aktif dengan batasan token yang aman
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 800 // <-- Batasan aman agar tidak melewati limit OTPM akun gratis
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Groq Error (${selectedModel}): ${data.error?.message || JSON.stringify(data)}`
      });
    }

    const reply = data.choices?.[0]?.message?.content || 'Maaf, tidak ada respons.';

    return res.status(200).json({
      reply: reply,
      candidates: [{ content: { parts: [{ text: reply }] } }]
    });

  } catch (error) {
    console.error("Error di API chat:", error);
    return res.status(500).json({ error: "Terjadi kesalahan pada server: " + error.message });
  }
}
