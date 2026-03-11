(function () {
  'use strict';

  window.__useMessagePanelV2 = true;

  const WS_SCHEME = location.protocol === 'https:' ? 'wss' : 'ws';
  const WS_URL_BASE = `${WS_SCHEME}://${location.host}/ws/messaging`;

  let ws = null;
  let contacts = {};
  let conversations = {};
  let currentPeer = null;
  let filterMode = 'all';
  let searchNeedle = '';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function currentUserRawId() {
    try {
      if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
        const tabData = sessionManager.getTabSession('adminData');
        const id = String(tabData?.id || tabData?.admin_id || '').trim();
        if (id) return id;
      }
    } catch (_) {}

    try {
      const raw = localStorage.getItem('adminData');
      if (raw) {
        const parsed = JSON.parse(raw);
        const id = String(parsed?.id || parsed?.admin_id || '').trim();
        if (id) return id;
      }
    } catch (_) {}

    return '';
  }

  function currentUserName() {
    try {
      if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
        const tabData = sessionManager.getTabSession('adminData');
        const name = String(tabData?.name || '').trim();
        if (name) return name;
      }
    } catch (_) {}

    try {
      const raw = localStorage.getItem('adminData');
      if (raw) {
        const parsed = JSON.parse(raw);
        const name = String(parsed?.name || '').trim();
        if (name) return name;
      }
    } catch (_) {}

    return String(document.getElementById('adminName')?.textContent || 'Admin').trim();
  }

  function myChatId() {
    const raw = currentUserRawId();
    return raw ? `admin:${raw}` : '';
  }

  function detectTenantCode() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
      if (fromQuery) return fromQuery;
    } catch (_) {}

    try {
      const fromStorage = String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
      if (fromStorage) return fromStorage;
    } catch (_) {}

    return '';
  }

  function formatTime(ts) {
    const d = new Date(Number(ts || Date.now()));
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getInitials(name) {
    const text = String(name || '').trim();
    if (!text) return 'NA';
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    return text.slice(0, 2).toUpperCase();
  }

  async function apiFetch(path, opts = {}) {
    if (typeof window.apiFetch === 'function') {
      return window.apiFetch(path, opts);
    }

    const school = (() => {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = String(params.get('school') || params.get('tenant') || '').trim().toLowerCase();
        if (fromQuery) return fromQuery;
      } catch (_) {}
      return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
    })();

    const url = new URL(path, window.location.origin);
    if (school) url.searchParams.set('school', school);

    const token = String(localStorage.getItem('adminAuthToken') || '').trim();
    const headers = {
      ...(opts.headers || {}),
      ...(school ? { 'x-tenant-code': school } : {}),
      ...(token && !(opts.headers && opts.headers.Authorization) ? { Authorization: `Bearer ${token}` } : {})
    };

    return fetch(url.pathname + url.search, {
      credentials: 'include',
      ...opts,
      headers
    });
  }

  function injectStyles() {
    if (document.getElementById('qmp2-style')) return;
    const style = document.createElement('style');
    style.id = 'qmp2-style';
    style.textContent = `
      .qmp2-panel{position:fixed;top:64px;right:0;width:720px;max-width:100vw;height:calc(100vh - 64px);display:none;z-index:1420;background:#0b1732;border-left:1px solid #1c2f56;color:#e5edf9}
      .qmp2-panel.active{display:flex}
      .qmp2-sidebar{width:260px;border-right:1px solid #1c2f56;display:flex;flex-direction:column}
      .qmp2-header{padding:12px 14px;border-bottom:1px solid #1c2f56;font-weight:700;font-size:13px}
      .qmp2-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .qmp2-close{width:28px;height:28px;border-radius:8px;border:1px solid #304a78;background:transparent;color:#cbd5e1;cursor:pointer}
      .qmp2-tools{display:flex;flex-direction:column;gap:8px;margin-top:10px}
      .qmp2-search{width:100%;border:1px solid #304a78;border-radius:8px;padding:8px 10px;background:#122340;color:#e5edf9}
      .qmp2-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
      .qmp2-filter{border:1px solid #304a78;border-radius:999px;background:transparent;color:#cbd5e1;font-size:11px;padding:6px 8px;cursor:pointer}
      .qmp2-filter.active{background:#16a34a;color:#fff;border-color:#16a34a}
      .qmp2-mark{border:1px solid #304a78;border-radius:8px;background:transparent;color:#e5edf9;font-size:11px;padding:7px 10px;cursor:pointer}
      .qmp2-list{flex:1;overflow:auto;padding:8px 0}
      .qmp2-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-left:3px solid transparent;cursor:pointer}
      .qmp2-item:hover{background:#122340}
      .qmp2-item.active{background:#16305a;border-left-color:#22c55e}
      .qmp2-avatar{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1f3a63;color:#86efac;font-weight:700}
      .qmp2-meta{flex:1;min-width:0}
      .qmp2-name{font-size:13px;font-weight:700;display:flex;justify-content:space-between;gap:8px}
      .qmp2-sub{font-size:12px;color:#9fb0cc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .qmp2-badge{min-width:18px;height:18px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0 5px}
      .qmp2-window{flex:1;display:flex;flex-direction:column}
      .qmp2-wheader{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1c2f56}
      .qmp2-title{font-size:30px;font-weight:700;font-size:14px}
      .qmp2-state{font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid #334f80;color:#cbd5e1}
      .qmp2-state.connected{border-color:#16a34a;color:#86efac}
      .qmp2-messages{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
      .qmp2-msg{max-width:78%;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.35}
      .qmp2-msg.them{background:#122340;color:#e5edf9;align-self:flex-start}
      .qmp2-msg.me{background:#1d4ed8;color:#fff;align-self:flex-end}
      .qmp2-ts{display:block;font-size:10px;opacity:.75;margin-top:4px}
      .qmp2-empty{margin:auto;color:#9fb0cc}
      .qmp2-input{display:flex;gap:10px;padding:12px 14px;border-top:1px solid #1c2f56}
      .qmp2-input input{flex:1;border:1px solid #304a78;border-radius:10px;padding:10px 12px;background:#122340;color:#e5edf9}
      .qmp2-input button{border:none;border-radius:10px;padding:10px 14px;background:#16a34a;color:#fff;font-weight:700;cursor:pointer}
      @media(max-width:900px){.qmp2-panel{width:100vw}.qmp2-sidebar{width:100%}.qmp2-window{display:none}.qmp2-panel[data-active='1'] .qmp2-sidebar{display:none}.qmp2-panel[data-active='1'] .qmp2-window{display:flex}}
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    if (document.getElementById('qmp2Panel')) return;

    const old = document.getElementById('chatPanel');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = 'qmp2Panel';
    panel.className = 'qmp2-panel';
    panel.setAttribute('data-active', '0');
    panel.innerHTML = `
      <div class="qmp2-sidebar">
        <div class="qmp2-header">
          <div class="qmp2-top"><span>Chats</span><button id="qmp2Close" class="qmp2-close" aria-label="Close messages">✕</button></div>
          <div class="qmp2-tools">
            <input id="qmp2Search" class="qmp2-search" type="text" placeholder="Search conversation...">
            <div class="qmp2-filters">
              <button class="qmp2-filter active" data-filter="all">All</button>
              <button class="qmp2-filter" data-filter="unread">Unread</button>
              <button class="qmp2-filter" data-filter="online">Online</button>
            </div>
            <button id="qmp2MarkRead" class="qmp2-mark" type="button">Mark all as read</button>
          </div>
        </div>
        <div id="qmp2List" class="qmp2-list"></div>
      </div>
      <div class="qmp2-window">
        <div class="qmp2-wheader"><div id="qmp2Title" class="qmp2-title">Select a conversation</div><span id="qmp2State" class="qmp2-state">Disconnected</span></div>
        <div id="qmp2Messages" class="qmp2-messages"><div class="qmp2-empty">No messages yet. Start the conversation!</div></div>
        <div class="qmp2-input"><input id="qmp2Input" placeholder="Type a message..."><button id="qmp2Send" type="button">Send</button></div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  function setConnectionState(stateText, connected) {
    const stateEl = document.getElementById('qmp2State');
    if (!stateEl) return;
    stateEl.textContent = stateText;
    stateEl.classList.toggle('connected', !!connected);
  }

  function updateBadge() {
    const badge = document.getElementById('chatBadge');
    if (!badge) return;
    const total = Object.values(conversations).reduce((sum, conv) => sum + Number(conv.unread || 0), 0);
    badge.textContent = String(total);
    badge.style.display = total > 0 ? 'inline-block' : 'none';
  }

  function renderList() {
    const list = document.getElementById('qmp2List');
    if (!list) return;

    const me = myChatId();
    const entries = Object.values(contacts)
      .filter((c) => c.id && c.id !== me)
      .sort((a, b) => {
        const aLast = Number(conversations[a.id]?.lastTs || 0);
        const bLast = Number(conversations[b.id]?.lastTs || 0);
        if (aLast !== bLast) return bLast - aLast;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

    const needle = searchNeedle.trim().toLowerCase();
    const filtered = entries.filter((c) => {
      const conv = conversations[c.id] || {};
      if (filterMode === 'unread' && !(conv.unread > 0)) return false;
      if (filterMode === 'online' && !c.online) return false;
      if (needle) {
        const hay = `${c.name || ''} ${c.email || ''} ${conv.lastMessage || ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      list.innerHTML = '<div class="qmp2-empty">No conversations available.</div>';
      return;
    }

    list.innerHTML = filtered.map((c) => {
      const conv = conversations[c.id] || { unread: 0, lastMessage: '' };
      return `
        <div class="qmp2-item ${currentPeer === c.id ? 'active' : ''}" data-peer="${escapeHtml(c.id)}">
          <div class="qmp2-avatar">${escapeHtml(getInitials(c.name || c.id))}</div>
          <div class="qmp2-meta">
            <div class="qmp2-name"><span>${escapeHtml(c.name || c.id)}</span><span>${c.online ? '●' : '○'}</span></div>
            <div class="qmp2-sub">${escapeHtml(conv.lastMessage || 'No messages yet')}</div>
          </div>
          ${conv.unread > 0 ? `<div class="qmp2-badge">${conv.unread}</div>` : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.qmp2-item').forEach((item) => {
      item.addEventListener('click', () => {
        const peer = item.getAttribute('data-peer') || '';
        if (!peer) return;
        openConversation(peer);
      });
    });
  }

  function renderMessages() {
    const box = document.getElementById('qmp2Messages');
    const title = document.getElementById('qmp2Title');
    const panel = document.getElementById('qmp2Panel');
    if (!box || !title || !panel) return;

    if (!currentPeer) {
      title.textContent = 'Select a conversation';
      panel.setAttribute('data-active', '0');
      box.innerHTML = '<div class="qmp2-empty">No messages yet. Start the conversation!</div>';
      return;
    }

    panel.setAttribute('data-active', '1');
    const contact = contacts[currentPeer];
    const conv = conversations[currentPeer] || { msgs: [] };
    title.textContent = contact?.name || currentPeer;

    const msgs = (conv.msgs || []).slice().sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
    if (!msgs.length) {
      box.innerHTML = '<div class="qmp2-empty">No messages yet. Start the conversation!</div>';
      return;
    }

    const mine = myChatId();
    box.innerHTML = msgs.map((m) => {
      const from = String(m.from || m.fromId || '');
      const text = String(m.text || m.body || m.message || '');
      const cls = from === mine ? 'me' : 'them';
      return `<div class="qmp2-msg ${cls}">${escapeHtml(text)}<span class="qmp2-ts">${escapeHtml(formatTime(m.ts || Date.now()))}</span></div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  function openConversation(peerId) {
    currentPeer = String(peerId || '');
    conversations[currentPeer] = conversations[currentPeer] || { peerId: currentPeer, msgs: [], lastMessage: '', lastTs: 0, unread: 0 };
    conversations[currentPeer].unread = 0;
    renderList();
    renderMessages();
    updateBadge();
  }

  function normalizeMessage(msgRaw) {
    const from = String(msgRaw.from || msgRaw.fromId || msgRaw.sender || msgRaw.senderId || '');
    const to = String(msgRaw.to || msgRaw.toId || msgRaw.recipient || msgRaw.recipientId || '');
    const text = String(msgRaw.text || msgRaw.body || msgRaw.message || '');
    const ts = Number(msgRaw.ts || msgRaw.createdAt || Date.now());
    return { from, to, text, ts };
  }

  function upsertConversation(peer, message, incrementUnread) {
    conversations[peer] = conversations[peer] || { peerId: peer, msgs: [], lastMessage: '', lastTs: 0, unread: 0 };
    conversations[peer].msgs.push(message);
    conversations[peer].lastMessage = message.text;
    conversations[peer].lastTs = message.ts;
    if (incrementUnread) conversations[peer].unread = Number(conversations[peer].unread || 0) + 1;
  }

  function handleServerMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'presence') {
      const uid = String(msg.userId || '');
      if (!uid || uid === myChatId()) return;
      contacts[uid] = contacts[uid] || { id: uid, name: uid, online: false };
      contacts[uid].online = !!msg.online;
      renderList();
      return;
    }

    if (msg.type === 'init') {
      const list = Array.isArray(msg.conversations) ? msg.conversations : [];
      list.forEach((c) => {
        if (!c || !c.peerId) return;
        const peer = String(c.peerId);
        contacts[peer] = contacts[peer] || { id: peer, name: c.name || peer, online: !!c.online };
        conversations[peer] = {
          peerId: peer,
          name: c.name || peer,
          online: !!c.online,
          msgs: Array.isArray(c.msgs) ? c.msgs.map(normalizeMessage) : [],
          lastMessage: String(c.lastMessage || ''),
          lastTs: Number(c.lastTs || 0),
          unread: Number(c.unread || 0)
        };
      });
      renderList();
      renderMessages();
      updateBadge();
      return;
    }

    if (msg.type === 'message') {
      const mine = myChatId();
      const m = normalizeMessage(msg.message || msg);
      const peer = m.from === mine ? m.to : m.from;
      if (!peer || peer === mine) return;

      contacts[peer] = contacts[peer] || { id: peer, name: msg.fromName || msg.senderName || peer, online: false };
      const unread = currentPeer !== peer;
      upsertConversation(peer, m, unread);

      renderList();
      renderMessages();
      updateBadge();
    }
  }

  function connectWs() {
    if (!myChatId()) {
      setConnectionState('Disconnected', false);
      return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) return;

    setConnectionState('Connecting', false);
    const tenantCode = detectTenantCode();
    const wsUrl = tenantCode ? `${WS_URL_BASE}?school=${encodeURIComponent(tenantCode)}` : WS_URL_BASE;
    ws = new WebSocket(wsUrl);

    ws.addEventListener('open', () => {
      const authPayload = {
        type: 'auth',
        user: {
          id: myChatId(),
          rawId: currentUserRawId(),
          userType: 'admin',
          role: 'admin',
          name: currentUserName(),
          tenantCode
        },
        tenantCode
      };
      ws.send(JSON.stringify(authPayload));
      setConnectionState('Connected', true);
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data || '{}');
        handleServerMessage(msg);
      } catch (_) {}
    });

    ws.addEventListener('close', () => {
      setConnectionState('Disconnected', false);
      setTimeout(connectWs, 1500);
    });

    ws.addEventListener('error', () => {
      setConnectionState('Disconnected', false);
    });
  }

  async function loadContacts() {
    const me = myChatId();

    try {
      const teacherRes = await apiFetch('/api/teachers', { cache: 'no-store' });
      if (teacherRes.ok) {
        const data = await teacherRes.json().catch(() => []);
        (Array.isArray(data) ? data : []).forEach((t) => {
          const rawId = String(t.id || t.teacherId || t.teacher_id || '').trim();
          if (!rawId) return;
          const id = `teacher:${rawId}`;
          if (id === me) return;
          contacts[id] = {
            id,
            rawId,
            name: t.name || t.fullName || `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.email || `Teacher ${rawId}`,
            email: t.email || null,
            online: !!t.online,
            type: 'teacher'
          };
        });
      }
    } catch (_) {}

    try {
      const adminRes = await apiFetch('/api/admin/contacts', { cache: 'no-store' });
      if (adminRes.ok) {
        const data = await adminRes.json().catch(() => ({}));
        const admins = Array.isArray(data?.admins) ? data.admins : [];
        admins.forEach((a) => {
          const rawId = String(a.id || a.adminId || a.admin_id || '').trim();
          if (!rawId) return;
          const id = `admin:${rawId}`;
          if (id === me) return;
          contacts[id] = {
            id,
            rawId,
            name: a.name || a.email || `Admin ${rawId}`,
            email: a.email || null,
            online: !!a.online,
            type: 'admin'
          };
        });
      }
    } catch (_) {}

    renderList();
  }

  function sendCurrentMessage() {
    const input = document.getElementById('qmp2Input');
    if (!input || !currentPeer) return;
    const text = String(input.value || '').trim();
    if (!text) return;

    const message = {
      type: 'message',
      to: currentPeer,
      text,
      fromId: myChatId(),
      fromName: currentUserName(),
      ts: Date.now()
    };

    const local = { from: myChatId(), to: currentPeer, text, ts: message.ts };
    upsertConversation(currentPeer, local, false);
    renderList();
    renderMessages();

    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (_) {}

    (async () => {
      try {
        await apiFetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: myChatId(), to: currentPeer, text, ts: message.ts })
        });
      } catch (_) {}
    })();

    input.value = '';
  }

  function init() {
    injectStyles();
    createPanel();

    const panel = document.getElementById('qmp2Panel');
    const chatBtn = document.getElementById('chatBtn');
    const closeBtn = document.getElementById('qmp2Close');
    const search = document.getElementById('qmp2Search');
    const sendBtn = document.getElementById('qmp2Send');
    const input = document.getElementById('qmp2Input');
    const markReadBtn = document.getElementById('qmp2MarkRead');

    if (!panel || !chatBtn) return;

    chatBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      panel.classList.add('active');
      loadContacts();
      connectWs();
    }, true);

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        panel.classList.remove('active');
        panel.setAttribute('data-active', '0');
      });
    }

    if (search) {
      search.addEventListener('input', () => {
        searchNeedle = search.value || '';
        renderList();
      });
    }

    document.querySelectorAll('.qmp2-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterMode = btn.getAttribute('data-filter') || 'all';
        document.querySelectorAll('.qmp2-filter').forEach((x) => x.classList.toggle('active', x === btn));
        renderList();
      });
    });

    if (markReadBtn) {
      markReadBtn.addEventListener('click', () => {
        Object.keys(conversations).forEach((k) => {
          conversations[k].unread = 0;
        });
        updateBadge();
        renderList();
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendCurrentMessage);
    if (input) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendCurrentMessage();
        }
      });
    }

    window.__openMessagePanelV2 = async function () {
      panel.classList.add('active');
      await loadContacts();
      connectWs();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

