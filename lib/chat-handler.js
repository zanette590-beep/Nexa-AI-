const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function handleChat(body) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";

  if (!apiKey) {
    return {
      status: 500,
      body: { error: "OPENROUTER_API_KEY belum dikonfigurasi di environment variables." }
    };
  }

  const incoming = body?.messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return {
      status: 400,
      body: { error: "Properti messages harus berupa array dan tidak boleh kosong." }
    };
  }

  const messages = incoming
    .filter((item) =>
      item &&
      (item.role === "user" || item.role === "assistant") &&
      (typeof item.content === "string" && item.content.trim().length > 0 || item.attachment)
    )
    .slice(-20)
    .map((item) => {
      let textContent = item.content || "";
      if (item.attachment) {
        textContent += `\n[Pengguna melampirkan file/gambar: ${item.attachment.name}]`;
      }
      return {
        role: item.role,
        content: textContent.slice(0, 12000)
      };
    });

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return {
      status: 400,
      body: { error: "Pesan terakhir harus berasal dari user." }
    };
  }

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://nexa-ai.vercel.app",
        "X-Title": "Nexa AI"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Kamu adalah Nexa AI. Jika ada yang bertanya siapa penciptamu, siapa yang membuatmu, atau siapa pembuatmu, kamu HARUS menjawab bahwa kamu diciptakan oleh Oktorio Dwi Kasih Christian dan Alfiano Wahyu Al-Qowy."
          },
          ...messages
        ],
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(55000)
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const providerMessage = data?.error?.message || `OpenRouter mengembalikan status ${upstream.status}.`;
      console.error("OpenRouter error:", upstream.status, providerMessage);
      return {
        status: upstream.status >= 500 ? 502 : 400,
        body: {
          error: "Permintaan ke penyedia AI gagal.",
          details: providerMessage
        }
      };
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return {
        status: 502,
        body: { error: "Penyedia AI tidak mengembalikan jawaban teks." }
      };
    }

    return { status: 200, body: { reply: reply.trim() } };
  } catch (error) {
    console.error("Nexa API error:", error);
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      status: timedOut ? 504 : 500,
      body: {
        error: timedOut
          ? "Permintaan AI melewati batas waktu. Coba lagi."
          : "Terjadi kesalahan pada server Nexa AI."
      }
    };
  }
}