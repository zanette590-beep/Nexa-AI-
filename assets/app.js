// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyB8HiVHB06Mg3gatXBRU4ccyf_wOEJhIfs",
  authDomain: "nexa-ai-users.firebaseapp.com",
  projectId: "nexa-ai-users",
  storageBucket: "nexa-ai-users.firebasestorage.app",
  messagingSenderId: "759430454615",
  appId: "1:759430454615:web:6ff42b7179514337453212"
};

// Inisialisasi Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- NEXA AI: MAIN APPLICATION CONTROLLER ---
const $ = (selector) => document.querySelector(selector);

const state = {
  chats: JSON.parse(localStorage.getItem("nexa_chats") || "[]"),
  activeId: null,
  busy: false
};

const messagesEl = $("#messages");
const input = $("#promptInput");
const welcome = $("#welcome");

function saveChats() {
  localStorage.setItem("nexa_chats", JSON.stringify(state.chats));
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

// Lightweight Markdown renderer (Diperbarui agar **bold** tampil bersih tanpa bintang)
function renderMarkdown(raw) {
  if (!raw) return "";
  const blocks = [];
  
  let safe = escapeHTML(raw).replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(`<pre><code>${code.trimEnd()}</code></pre>`);
    return `@@BLOCK${blocks.length - 1}@@`;
  });

  // Konversi tanda **teks** menjadi <strong>teks</strong>
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  
  // Konversi tanda *teks* menjadi <em>teks</em>
  safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  safe = safe.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  safe = safe.split(/\n{2,}/).map(part => {
    const blockMatch = part.match(/^@@BLOCK(\d+)@@$/);
    return blockMatch ? blocks[Number(blockMatch[1])] : `<p>${part.replace(/\n/g, "<br>")}</p>`;
  }).join("");
  
  return safe;
}

function currentChat() {
  return state.chats.find(chat => chat.id === state.activeId);
}

function renderHistory() {
  const container = $("#chatHistory");
  if (!container) return;
  if (!state.chats.length) {
    container.innerHTML = '<p class="empty-history" style="padding-left: 8px;">Percakapan akan muncul di sini.</p>';
    return;
  }
  container.innerHTML = "";
  [...state.chats].reverse().forEach(chat => {
    const button = document.createElement("button");
    button.className = "history-item" + (chat.id === state.activeId ? " active" : "");
    button.textContent = chat.title;
    button.title = chat.title;
    button.addEventListener("click", () => openChat(chat.id));
    container.appendChild(button);
  });
}

function renderMessage(message) {
  if (!messagesEl) return;
  const article = document.createElement("article");
  article.className = `message ${message.role}`;
  const isUser = message.role === "user";
  
  const savedUser = JSON.parse(localStorage.getItem("nexa_logged_user"));
  const userInitial = savedUser ? savedUser.name.charAt(0).toUpperCase() : "G";
  const userLabel = savedUser ? savedUser.name : "Guest User";
  
  let attachmentHTML = "";
  if (message.attachment) {
    if (message.attachment.mimeType && message.attachment.mimeType.startsWith("image/")) {
      attachmentHTML = `<div style="margin-bottom: 8px;"><img src="${message.attachment.dataUrl}" alt="${escapeHTML(message.attachment.name || 'lampiran')}" style="max-width: 240px; border-radius: 8px; display: block;"></div>`;
    } else if (message.attachment.name) {
      attachmentHTML = `<div style="margin-bottom: 8px; padding: 6px 10px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 0.85em;">📄 ${escapeHTML(message.attachment.name)}</div>`;
    }
  }

  article.innerHTML = `
    <div class="message-avatar">${isUser ? userInitial : "N"}</div>
    <div class="message-content">
      <div class="message-role">${isUser ? escapeHTML(userLabel) : "Nexa"}</div>
      ${attachmentHTML}
      <div class="message-text">${renderMarkdown(message.content)}</div>
      ${isUser ? "" : '<div class="message-actions"><button type="button" data-action="copy">Salin</button><button type="button" data-action="retry">Ulangi</button></div>'}
    </div>`;

  const copyBtn = article.querySelector('[data-action="copy"]');
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard?.writeText(message.content).then(() => {
        copyBtn.textContent = "Tersalin!";
        setTimeout(() => { copyBtn.textContent = "Salin"; }, 1500);
      }).catch(() => {
        alert("Gagal menyalin teks.");
      });
    });
  }

  const retryBtn = article.querySelector('[data-action="retry"]');
  if (retryBtn) {
    retryBtn.addEventListener("click", () => retryLast());
  }

  messagesEl.appendChild(article);
}

function openChat(id) {
  state.activeId = id;
  if (messagesEl) messagesEl.innerHTML = "";
  const chat = currentChat();
  if (chat) chat.messages.forEach(renderMessage);
  if (welcome) welcome.hidden = !!chat?.messages.length;
  renderHistory();
  closeSidebar();
  scrollToBottom();
}

function newChat() {
  state.activeId = null;
  if (messagesEl) messagesEl.innerHTML = "";
  if (welcome) welcome.hidden = false;
  if (input) input.value = "";
  clearAttachment();
  if (input) input.focus();
  renderHistory();
  closeSidebar();
}

function scrollToBottom() {
  const conv = $("#conversation");
  if (conv) conv.scrollTop = conv.scrollHeight;
}

// --- INDIKATOR: NEXA SEDANG MENGETIK ---
function showTyping() {
  if (!messagesEl) return;
  const node = document.createElement("article");
  node.className = "message assistant";
  node.id = "typingIndicator";
  node.innerHTML = `
    <div class="message-avatar">N</div>
    <div class="message-content">
      <div class="message-role">Nexa</div>
      <div class="typing-status" style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); font-style: italic;">
        <span>Nexa sedang mengetik</span>
        <div class="typing" style="margin: 0; padding: 0;"><i></i><i></i><i></i></div>
      </div>
    </div>`;
  messagesEl.appendChild(node);
  scrollToBottom();
}

function removeTyping() {
  $("#typingIndicator")?.remove();
}

function createChat(firstMessage) {
  const chat = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title: firstMessage.trim().slice(0, 42) || "Percakapan baru",
    messages: [],
    updatedAt: Date.now()
  };
  state.chats.push(chat);
  state.activeId = chat.id;
  return chat;
}

// --- FITUR LAMPIRAN FILE ---
const fileInput = document.getElementById("file-upload");
let currentAttachment = null;

function clearAttachment() {
  currentAttachment = null;
  if (fileInput) fileInput.value = "";
  if (input) input.placeholder = "Kirim pesan ke Nexa...";
}

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve({
          name: file.name || "gambar-paste.jpg",
          mimeType: "image/jpeg",
          base64: dataUrl.split(",")[1],
          dataUrl: dataUrl
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleSelectedFile(file) {
  if (!file) return;

  if (!file.type.startsWith("image/") && file.size > 2 * 1024 * 1024) {
    alert("Ukuran file maksimal 2MB ya!");
    return;
  }

  if (input) input.placeholder = "Memproses lampiran...";

  if (file.type.startsWith("image/")) {
    currentAttachment = await compressImage(file);
  } else {
    const reader = new FileReader();
    currentAttachment = await new Promise((resolve) => {
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        resolve({
          name: file.name,
          mimeType: file.type || "text/plain",
          base64: dataUrl.split(",")[1],
          dataUrl: dataUrl
        });
      };
      reader.readAsDataURL(file);
    });
  }

  if (input) {
    input.placeholder = `Terlampir: ${currentAttachment.name} (Ketik pesan lalu Enter)`;
    input.focus();
  }
}

if (fileInput) {
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleSelectedFile(file);
  });
}

if (input) {
  input.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === "file") {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleSelectedFile(file);
        break;
      }
    }
  });
}

// --- FITUR REKAM SUARA (SPEECH TO TEXT) ---
const micBtn = document.getElementById("micBtn");

if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = 'id-ID';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let isRecording = false;

  micBtn.addEventListener("click", () => {
    if (isRecording) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
    }
  });

  recognition.onstart = () => {
    isRecording = true;
    micBtn.style.color = "#ff4d4d";
    micBtn.title = "Mendengarkan... (Klik lagi untuk berhenti)";
    if (input) input.placeholder = "🎤 Sedang mendengarkan suara Anda...";
  };

  recognition.onresult = (event) => {
    const speechToText = event.results[0][0].transcript;
    if (input) {
      input.value = input.value ? input.value + " " + speechToText : speechToText;
      resizeInput();
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    alert("Gagal mengenali suara. Pastikan izin mikrofon di browser sudah diizinkan.");
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.style.color = "";
    micBtn.title = "Perintah Suara";
    if (input) input.placeholder = "Kirim pesan ke Nexa...";
  };
} else if (micBtn) {
  micBtn.style.display = "none";
}

async function askAI(chat) {
  const lastMsg = chat.messages[chat.messages.length - 1]?.content.toLowerCase() || "";
  if (lastMsg.includes("pencipta") || lastMsg.includes("siapa yang menciptakan") || lastMsg.includes("pembuatmu")) {
    return "Saya diciptakan oleh **Oktorio Dwi Kasih Christian** dan **Alfiano Wahyu Al-Qowy**. Mereka adalah pencipta dan pengembang brilian yang merancang sistem Nexa AI ini untuk membantu pengguna dalam berbagai tugas, memberikan informasi, serta berinteraksi sehari-hari.";
  }

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: chat.messages })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.details || data.error || `Server merespons ${response.status}`;
    throw new Error(detail);
  }
  if (!data.reply || typeof data.reply !== "string") throw new Error("Format respons API tidak sesuai.");
  return data.reply;
}

// --- FUNGSI PENGELOLA TOKEN & FIREBASE AUTH ---
function checkAndConsumeTokenForSend() {
  const savedUser = JSON.parse(localStorage.getItem("nexa_logged_user"));
  if (savedUser) return true; // Unlimited jika sudah login

  let currentTokens = parseInt(localStorage.getItem("nexa_tokens") || "50000", 10);
  
  if (currentTokens <= 0) {
    document.getElementById("authGate")?.classList.remove("hidden");
    return false;
  }

  currentTokens = Math.max(0, currentTokens - 500);
  localStorage.setItem("nexa_tokens", currentTokens);

  const tokenCountEl = document.getElementById("tokenCount");
  const tokenPill = document.getElementById("tokenPill");
  if (tokenCountEl) tokenCountEl.textContent = currentTokens;
  if (currentTokens <= 1000 && tokenPill) {
    tokenPill.classList.add("low");
  }

  if (currentTokens === 0) {
    setTimeout(() => {
      document.getElementById("authGate")?.classList.remove("hidden");
    }, 300);
  }

  return true;
}

async function sendMessage(text) {
  const value = text ? text.trim() : "";
  if (!value && !currentAttachment) return;
  if (state.busy) return;

  if (!checkAndConsumeTokenForSend()) return;

  let chat = currentChat();
  if (!chat) chat = createChat(value || (currentAttachment ? `Lampiran: ${currentAttachment.name}` : "Pesan baru"));

  const newMessage = {
    role: "user",
    content: value || "Tolong analisis lampiran ini."
  };

  if (currentAttachment) {
    newMessage.attachment = {
      name: currentAttachment.name,
      mimeType: currentAttachment.mimeType,
      base64: currentAttachment.base64,
      dataUrl: currentAttachment.dataUrl
    };
  }

  chat.messages.push(newMessage);
  chat.updatedAt = Date.now();
  if (welcome) welcome.hidden = true;
  renderMessage(newMessage);
  
  if (input) input.value = "";
  clearAttachment();
  resizeInput();
  state.busy = true;
  
  const sendBtn = $("#sendBtn");
  if (sendBtn) sendBtn.disabled = true;
  
  showTyping();
  saveChats();
  renderHistory();

  try {
    const reply = await askAI(chat);
    chat.messages.push({ role: "assistant", content: reply });
    removeTyping();
    renderMessage(chat.messages[chat.messages.length - 1]);
  } catch (error) {
    removeTyping();
    const message = `Nexa AI belum bisa memproses pesan. ${error.message}`;
    chat.messages.push({ role: "assistant", content: message });
    renderMessage(chat.messages[chat.messages.length - 1]);
  } finally {
    state.busy = false;
    if (sendBtn) sendBtn.disabled = false;
    saveChats();
    renderHistory();
    scrollToBottom();
  }
}

function retryLast() {
  const chat = currentChat();
  if (!chat || state.busy) return;
  if (chat.messages.at(-1)?.role === "assistant") chat.messages.pop();
  const lastUser = [...chat.messages].reverse().find(message => message.role === "user");
  if (!lastUser) return;
  if (messagesEl) messagesEl.innerHTML = "";
  chat.messages.forEach(renderMessage);
  chat.messages.pop();
  if (lastUser.attachment) currentAttachment = lastUser.attachment;
  sendMessage(lastUser.content);
}

function resizeInput() {
  if (!input) return;
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");
  $("#overlay")?.classList.remove("show");
}

const chatForm = $("#chatForm");
if (chatForm) {
  chatForm.addEventListener("submit", event => {
    event.preventDefault();
    if (input) sendMessage(input.value);
  });
}

if (input) {
  input.addEventListener("input", resizeInput);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm?.requestSubmit();
    }
  });
}

// --- KONTROL TOMBOL SIDEBAR & PENCARIAN ---
const sidebar = $("#sidebar");
const overlay = $("#overlay");
const customSidebarToggleBtn = $("#customSidebarToggleBtn");
const customSearchBtn = $("#customSearchBtn");
const chatSearchInput = $("#chatSearchInput");

function toggleSidebar() {
  sidebar?.classList.toggle("open");
  overlay?.classList.toggle("show");
}

if (customSidebarToggleBtn) {
  customSidebarToggleBtn.addEventListener("click", toggleSidebar);
}

$("#openSidebar")?.addEventListener("click", () => {
  sidebar?.classList.add("open");
  overlay?.classList.add("show");
});

$("#closeSidebar")?.addEventListener("click", closeSidebar);
overlay?.addEventListener("click", closeSidebar);

if (customSearchBtn && chatSearchInput) {
  customSearchBtn.addEventListener("click", () => {
    chatSearchInput.focus();
  });
}

if (chatSearchInput) {
  chatSearchInput.addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase();
    const historyItems = document.querySelectorAll(".history-list button");
    historyItems.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(keyword) ? "block" : "none";
    });
  });
}

$("#newChat")?.addEventListener("click", newChat);
$("#themeToggle")?.addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("nexa_theme", document.body.classList.contains("light") ? "light" : "dark");
});

// --- FITUR SHARE CHAT ---
$("#shareChat")?.addEventListener("click", async () => {
  const chat = currentChat();
  if (!chat || !chat.messages.length) {
    alert("Belum ada percakapan aktif untuk dibagikan.");
    return;
  }

  const formattedText = chat.messages.map(m => `${m.role === "user" ? "Anda" : "Nexa AI"}:\n${m.content}`).join("\n\n---\n\n");
  const shareTitle = `Percakapan Nexa AI: ${chat.title}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: formattedText
      });
      return;
    } catch (err) {
      if (err.name !== "AbortError") {
        console.log("Share dibatalkan atau gagal:", err);
      }
    }
  }

  try {
    await navigator.clipboard.writeText(formattedText);
    alert("✨ Percakapan berhasil disalin ke clipboard!");
  } catch (err) {
    alert("Tidak dapat mengakses clipboard pada browser ini.");
  }
});

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.prompt) sendMessage(button.dataset.prompt);
  });
});

if (localStorage.getItem("nexa_theme") === "light") document.body.classList.add("light");
renderHistory();
if (state.chats.length) openChat(state.chats[state.chats.length - 1].id);

// --- FIREBASE UI & AUTH MANAGEMENT ---
document.addEventListener("DOMContentLoaded", () => {
  const userNameDisplay = $("#userNameDisplay");
  const userStatusDisplay = $("#userStatusDisplay");
  const userAvatar = $("#userAvatar");
  const authActionBtn = $("#authActionBtn");
  const tokenCountEl = $("#tokenCount");
  const tokenPill = $("#tokenPill");
  const tokenLabel = $("#tokenLabel");
  
  const authGate = $("#authGate");
  const googleLoginBtn = $("#googleLoginBtn");
  const authInfoMsg = $("#authInfoMsg");
  
  const profileBox = $("#profileBox");
  const logoutModal = $("#logoutModal");
  const logoutUserName = $("#logoutUserName");
  const cancelLogoutBtn = $("#cancelLogoutBtn");
  const confirmLogoutBtn = $("#confirmLogoutBtn");

  let currentTokens = parseInt(localStorage.getItem("nexa_tokens") || "50000", 10);

  function updateUI() {
    const savedUser = JSON.parse(localStorage.getItem("nexa_logged_user"));
    if (savedUser) {
      if(userNameDisplay) userNameDisplay.textContent = savedUser.name;
      if(userStatusDisplay) userStatusDisplay.textContent = "Pro Member (Unlimited)";
      if(userAvatar) {
        if (savedUser.photo) {
          userAvatar.innerHTML = `<img src="${savedUser.photo}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
          userAvatar.textContent = savedUser.name.charAt(0).toUpperCase();
        }
      }
      if(authActionBtn) authActionBtn.textContent = "Keluar";
      if(tokenCountEl) tokenCountEl.textContent = "∞";
      if(tokenLabel) tokenLabel.textContent = "Unlimited";
      if(tokenPill) tokenPill.classList.remove("low");
    } else {
      if(userNameDisplay) userNameDisplay.textContent = "Guest User";
      if(userStatusDisplay) userStatusDisplay.textContent = "Free Trial Mode";
      if(userAvatar) userAvatar.textContent = "G";
      if(authActionBtn) authActionBtn.textContent = "Masuk";
      if(tokenCountEl) tokenCountEl.textContent = currentTokens;
      if(tokenLabel) tokenLabel.textContent = "Token";
      if(currentTokens <= 1000) {
        if(tokenPill) tokenPill.classList.add("low");
      } else {
        if(tokenPill) tokenPill.classList.remove("low");
      }
    }
  }

  updateUI();

  // Tombol Google Login via Firebase
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        const userData = {
          uid: user.uid,
          name: user.displayName || "Google User",
          email: user.email,
          photo: user.photoURL
        };

        // Simpan ke LocalStorage aplikasi
        localStorage.setItem("nexa_logged_user", JSON.stringify(userData));

        // Simpan / Update data user ke Firestore Database secara otomatis
        await db.collection("users").doc(user.uid).set({
          uid: user.uid,
          nama: user.displayName,
          email: user.email,
          foto: user.photoURL,
          terakhirLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        updateUI();
        if(authGate) authGate.classList.add("hidden");
        if(authInfoMsg) authInfoMsg.style.display = "none";
      } catch (error) {
        console.error("Gagal login Google:", error);
        if(authInfoMsg) {
          authInfoMsg.textContent = "Gagal login dengan Google: " + error.message;
          authInfoMsg.style.display = "block";
        }
      }
    });
  }

  if (profileBox) {
    profileBox.addEventListener("click", () => {
      const savedUser = JSON.parse(localStorage.getItem("nexa_logged_user"));
      if (savedUser) {
        if(logoutUserName) logoutUserName.textContent = savedUser.name;
        if(logoutModal) logoutModal.classList.remove("hidden");
      } else {
        if(authGate) authGate.classList.remove("hidden");
      }
    });
  }

  if (cancelLogoutBtn) {
    cancelLogoutBtn.addEventListener("click", () => {
      if(logoutModal) logoutModal.classList.add("hidden");
    });
  }

  if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener("click", async () => {
      try {
        await auth.signOut();
      } catch (e) {
        console.error(e);
      }
      localStorage.removeItem("nexa_logged_user");
      currentTokens = 50000;
      localStorage.setItem("nexa_tokens", currentTokens);
      updateUI();
      if(logoutModal) logoutModal.classList.add("hidden");
      if(authGate) authGate.classList.remove("hidden");
    });
  }
});

// --- OPENING ANIMATION DISMISS ---
window.addEventListener("load", () => {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    setTimeout(() => {
      splash.classList.add("fade-out");
      setTimeout(() => {
        splash.remove();
      }, 850);
    }, 2000);
  }
});
