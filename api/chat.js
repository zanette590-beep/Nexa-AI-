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

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: formattedMessages,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Groq Error: ${data.error?.message || JSON.stringify(data)}` 
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
