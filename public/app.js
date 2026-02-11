(function () {
  const token = localStorage.getItem("chat_token");
  const me = safeJson(localStorage.getItem("chat_user"));

  if (!token || !me?.username) {
    window.location.href = "/login";
    return;
  }

  $("#whoami").text(`Welcome,  ${me.firstname} ${me.lastname} (@${me.username})`);

  let currentRoom = null;
  let dmWith = null;

  const socket = io({
    auth: { token }
  });

  socket.on("connect_error", (err) => {
    console.log("socket error:", err.message);
  });

  socket.on("session:ready", () => {
    loadRooms();
  });

  socket.on("message:group", (msg) => {
    if (dmWith) return;
    if (!currentRoom || msg.room !== currentRoom) return;
    renderMessage(msg.from_user, msg.message, msg.date_sent);
  });

  socket.on("message:private", (msg) => {
    const other = msg.from_user === me.username ? msg.to_user : msg.from_user;
    if (dmWith !== other) return;
    renderMessage(`${msg.from_user} → ${msg.to_user}`, msg.message, msg.date_sent);
  });

  socket.on("room:system", (data) => {
    if (dmWith) return;
    if (data.room !== currentRoom) return;
    renderSystem(data.message);
  });

  let typingTimer = null;
  socket.on("typing:private", (data) => {
    if (!dmWith) return;
    if (data.from_user !== dmWith) return;

    $("#typingLine").text(data.isTyping ? `${dmWith} is typing...` : "");
  });

  $("#logoutBtn").on("click", () => {
    localStorage.removeItem("chat_token");
    localStorage.removeItem("chat_user");
    window.location.href = "/login";
  });

  $("#leaveRoomBtn").on("click", () => {
    dmWith = null;
    setModeBadge();

    socket.emit("room:leave", () => {
      currentRoom = null;
      $("#chatTitle").text("Currently not in a room");
      $("#messages").empty();
      $("#typingLine").text("");
      $("#hintLine").text("Choose a room to chat!");
    });
  });

  $("#openDmBtn").on("click", async () => {
    const other = ($("#dmUser").val() || "").trim();
    if (!other) return alert("Enter a username to DM.");
    if (other === me.username) return alert("You can’t DM yourself.");

    dmWith = other;
    currentRoom = null;
    setModeBadge();

    $("#chatTitle").text(`DM with @${dmWith}`);
    $("#messages").empty();
    $("#typingLine").text("");

    await loadPrivateHistory(dmWith);
    scrollDown();
  });

  $("#sendForm").on("submit", async (e) => {
    e.preventDefault();

    const text = ($("#messageInput").val() || "").trim();
    if (!text) return;

    $("#messageInput").val("");

    if (dmWith) {
      socket.emit("message:private", { to_user: dmWith, message: text }, (ack) => {
        if (!ack?.ok) alert(ack?.message || "DM error");
      });
      socket.emit("typing:private", { to_user: dmWith, isTyping: false });
      return;
    }

    socket.emit("message:group", { message: text }, (ack) => {
      if (!ack?.ok) alert(ack?.message || "Send error");
    });
  });

  $("#messageInput").on("input", () => {
    if (!dmWith) return;

    socket.emit("typing:private", { to_user: dmWith, isTyping: true });

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit("typing:private", { to_user: dmWith, isTyping: false });
    }, 700);
  });

  async function loadRooms() {
    const rooms = await apiGet("/api/messages/rooms");
    $("#rooms").empty();

    rooms.rooms.forEach((room) => {
      const btn = $(`<button class="list-group-item list-group-item-action">${room}</button>`);
      btn.on("click", () => joinRoom(room));
      $("#rooms").append(btn);
    });

    $("#hintLine").text("Join a room or open a direct message (DM).");
  }

  function joinRoom(room) {
    dmWith = null;
    setModeBadge();

    socket.emit("room:join", room, async (ack) => {
      if (!ack?.ok) return alert(ack?.message || "Error, can't join.");

      currentRoom = room;
      $("#chatTitle").text(`Room: ${room}`);
      $("#messages").empty();
      $("#typingLine").text("");

      await loadRoomHistory(room);
      scrollDown();
    });
  }

  async function loadRoomHistory(room) {
    const out = await apiGet(`/api/messages/group/${encodeURIComponent(room)}`);
    $("#messages").empty();

    out.messages.forEach((m) => {
      renderMessage(m.from_user, m.message, m.date_sent);
    });
  }

  async function loadPrivateHistory(otherUser) {
    const out = await apiGet(`/api/messages/private/${encodeURIComponent(otherUser)}`);
    $("#messages").empty();

    out.messages.forEach((m) => {
      renderMessage(`${m.from_user} → ${m.to_user}`, m.message, m.date_sent);
    });
  }

  function renderMessage(from, message, dateSent) {
    const isMe = String(from).includes(me.username) || from === me.username;
    const time = prettyTime(dateSent);

    const el = $(`
      <div class="msg ${isMe ? "me" : ""}">
        <div class="meta">${escapeHtml(from)} • ${escapeHtml(time)}</div>
        <div>${escapeHtml(message)}</div>
      </div>
    `);

    $("#messages").append(el);
    scrollDown();
  }

  function renderSystem(text) {
    const el = $(`
      <div class="msg" style="background:#fbfbfd;">
        <div class="meta">system</div>
        <div>${escapeHtml(text)}</div>
      </div>
    `);
    $("#messages").append(el);
    scrollDown();
  }

  function setModeBadge() {
    $("#modeBadge").text(dmWith ? "mode: private" : "mode: group");
  }

  async function apiGet(url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      localStorage.removeItem("chat_token");
      localStorage.removeItem("chat_user");
      window.location.href = "/login";
      return;
    }

    return res.json();
  }

  function prettyTime(d) {
    const dt = d ? new Date(d) : new Date();
    return dt.toLocaleString();
  }

  function scrollDown() {
    const box = $("#messages")[0];
    if (box) box.scrollTop = box.scrollHeight;
  }

  function safeJson(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();