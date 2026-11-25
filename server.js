import { createServer } from "node:http";
import { readFile, readFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleChat } from "./lib/chat-handler.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const maxBodyBytes = 1024 * 1024;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function loadLocalEnv() {
  let contents;
  try {
    contents = readFileSync(resolve(root, ".env"), "utf8").replace(/^\uFEFF/, "");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;
    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error("Ukuran pesan melebihi batas.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Body request harus berupa JSON yang valid.");
    error.status = 400;
    throw error;
  }
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed." }, { Allow: "GET, HEAD" });
  }

  if (pathname !== "/" && !pathname.startsWith("/assets/")) {
    return sendJson(res, 404, { error: "File tidak ditemukan." });
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    return sendJson(res, 400, { error: "Path tidak valid." });
  }

  const filePath = resolve(root, `.${decodedPath}`);
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    return sendJson(res, 404, { error: "File tidak ditemukan." });
  }

  const contentType = contentTypes[extname(filePath).toLowerCase()];
  if (!contentType) return sendJson(res, 404, { error: "File tidak ditemukan." });

  readFile(filePath, (error, content) => {
    if (error) {
      if (error.code !== "ENOENT") console.error("Static file error:", error);
      return sendJson(res, error.code === "ENOENT" ? 404 : 500, {
        error: error.code === "ENOENT" ? "File tidak ditemukan." : "Gagal membaca file."
      });
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length
    });
    res.end(req.method === "HEAD" ? undefined : content);
  });
}

loadLocalEnv();

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT harus berupa angka antara 1 dan 65535.");
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;

  if (pathname === "/api/chat") {
    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed. Gunakan POST." }, { Allow: "POST" });
    }

    try {
      const body = await readJson(req);
      const result = await handleChat(body);
      return sendJson(res, result.status, result.body);
    } catch (error) {
      return sendJson(res, error.status || 500, {
        error: error.status ? error.message : "Terjadi kesalahan pada server Nexa AI."
      });
    }
  }

  return serveStatic(req, res, pathname);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Nexa AI berjalan di http://localhost:${port}`);
});
