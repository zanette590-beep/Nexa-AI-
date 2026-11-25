import { handleChat } from "../lib/chat-handler.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Gunakan POST." });
  }

  try {
    const body = req.body || {};
    const messages = body.messages || [];

    // Format pesan untuk memastikan lampiran (base64) terbaca oleh handler/AI
    const formattedMessages = messages.map((msg) => {
      const parts = [{ text: msg.content }];

      // Jika pesan dari user memiliki lampiran gambar/file dalam bentuk base64
      if (msg.attachment && msg.attachment.base64) {
        parts.push({
          inlineData: {
            mimeType: msg.attachment.mimeType,
            data: msg.attachment.base64
          }
        });
      }

      return {
        role: msg.role,
        parts: parts,
        // Mendukung properti content standar jika handler membutuhkannya
        content: msg.content,
        attachment: msg.attachment
      };
    });

    // Proses chat melalui handler utama dengan data yang sudah lengkap
    const result = await handleChat({ messages: formattedMessages });
    
    return res.status(result.status || 200).json(result.body || result);
  } catch (error) {
    console.error("Error di API chat:", error);
    return res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
}