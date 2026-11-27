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

    // 1. Cek otomatis model apa saja yang diizinkan oleh API Key ini
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const modelsData = await modelsRes.json();

    if (!modelsRes.ok) {
      return res.status(modelsRes.status).json({
        error: `Gagal cek daftar model Groq: ${modelsData.error?.message || JSON.stringify(modelsData)}`
      });
    }

    // Ambil daftar ID model aktif (hindari model audio/whisper/tts)
    const availableModels = (modelsData.data || [])
      .map(m => m.id)
      .filter(id => !id.includes('whisper') && !id.includes('orpheus') && !id.includes('guard'));

    if (availableModels.length === 0) {
      return res.status(403).json({
        error: `Tidak ada model chat yang aktif di akun Groq ini. Daftar mentah: ${JSON.stringify(modelsData.data)}`
      });
    }

    // Pilih model terbaik yang tersedia di akunmu
    const selectedModel =
      availableModels.find(id => id.includes('llama-3.3-70b')) ||
      availableModels.find(id => id.includes('llama-3.1-8b')) ||
      availableModels.find(id => id.includes('llama')) ||
      availableModels[0];

    const formattedMessages = messages.map((msg) => ({
      role: msg.role === 'model' ? 'assistant' : (msg.role || 'user'),
      content: msg.content || ''
    }));

    if (!formattedMessages.some(m => m.role === 'system')) {
      formattedMessages.unshift({
        role: 'system',
        content: 'Kamu adalah Nexa AI, asisten virtual cerdas tingkat lanjut.'
      });
    }

    // 2. Kirim chat menggunakan model yang sudah dipastikan aktif
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: formattedMessages,
        temperature: 0.7
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
