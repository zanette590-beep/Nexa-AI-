export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Gunakan POST." });
  }

  try {
    const body = req.body || {};
    const messages = body.messages || [];
    const model = body.model || 'llama-3.1-8b-instant'; // Default model aman

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY belum diatur di Environment Variables Vercel." });
    }

    // Format pesan agar kompatibel dengan Groq (OpenAI format)
    const formattedMessages = messages.map((msg) => ({
      role: msg.role === 'model' ? 'assistant' : (msg.role || 'user'),
      content: msg.content || ''
    }));

    // Tambahkan system prompt dasar jika belum ada
    if (!formattedMessages.some(m => m.role === 'system')) {
      formattedMessages.unshift({
        role: 'system',
        content: 'Kamu adalah Nexa AI, asisten virtual cerdas tingkat lanjut.'
      });
    }

    // Panggil Groq API langsung dari serverless function
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Menggunakan model universal Groq yang stabil
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gagal memanggil Groq API' });
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
