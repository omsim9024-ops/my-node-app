(() => {
  const WS_SCHEME = location.protocol === 'https:' ? 'wss' : 'ws';
  const TENANT_CODE = detectTenantCode();
  const GROUP_PREFIX = 'group:'; // prefix used to identify group conversations

  // storage for group metadata fetched from server
  let GROUPS = {}; // keyed by groupId (number) -> {id,name,members:[]}

  const WS_URL = buildWsUrl(window.MESSAGING_WS_URL || `${WS_SCHEME}://${location.host}/ws/messaging`, TENANT_CODE);
  let ws;
  let conversations = {}; // keyed by peer id
  let currentPeer = null;
  let pendingDeletePeer = null;
  let pendingDeleteTimer = null;
  let currentFilter = 'all';
  let currentSearch = '';
  let conversationPrefs = { pinned: {}, muted: {}, deleted: {} };
  const HIDDEN_ADMIN_CONTACT_NAMES = new Set(['new admin test', 'test admin', 'guidance']);
  // Contacts will be loaded from the server (teachers + admins)
  let TEACHERS = [];
  const CONTACTS = {}; // id -> {id,name,email,avatar,online}

  function detectTenantCode(){
    try {
      const params = new URLSearchParams(window.location.search || '');
      const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
      if(fromQuery) return fromQuery;
    } catch (_e) {}

    try {
      const fromStorage = String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
      if(fromStorage) return fromStorage;
    } catch (_e) {}

    return '';
  }

  function buildWsUrl(baseUrl, tenantCode){
    try {
      const url = new URL(String(baseUrl || ''), window.location.origin);
      if(tenantCode) url.searchParams.set('school', tenantCode);
      return url.toString();
    } catch (_e) {
      const raw = String(baseUrl || `${WS_SCHEME}://${location.host}/ws/messaging`);
      if(!tenantCode) return raw;
      const separator = raw.includes('?') ? '&' : '?';
      return `${raw}${separator}school=${encodeURIComponent(tenantCode)}`;
    }
  }

  async function apiFetch(path, opts = {}){
    const requestUrl = new URL(String(path || '/'), window.location.origin);
    if(TENANT_CODE) requestUrl.searchParams.set('school', TENANT_CODE);

    const knownTokens = [
      localStorage.getItem('adminAuthToken'),
      localStorage.getItem('teacherAuthToken'),
      localStorage.getItem('adviserAuthToken'),
      localStorage.getItem('authToken')
    ].map(v => String(v || '').trim()).filter(Boolean);

    const headers = {
      ...(opts.headers || {}),
      ...(TENANT_CODE ? { 'x-tenant-code': TENANT_CODE } : {}),
      ...((knownTokens[0] && !(opts.headers && opts.headers.Authorization)) ? { Authorization: `Bearer ${knownTokens[0]}` } : {})
    };

    return fetch(`${requestUrl.pathname}${requestUrl.search}`, {
      credentials: 'include',
      ...opts,
      headers
    });
  }

  function shouldHideAdminContact(contact){
    if(!contact) return false;
    const normalizedName = String(contact.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    return HIDDEN_ADMIN_CONTACT_NAMES.has(normalizedName);
  }

  function normalizeUserType(input){
    const value = String(input || '').toLowerCase().trim();
    if(value === 'admin' || value === 'guidance' || value === 'master') return 'admin';
    return 'teacher';
  }

  function toChatId(userType, rawId){
    const type = normalizeUserType(userType);
    return `${type}:${String(rawId || '').trim()}`;
  }

  function currentUserType(){
    return normalizeUserType(window.CURRENT_USER?.userType || window.CURRENT_USER?.role);
  }

  function currentUserRawId(){
    return String(window.CURRENT_USER?.rawId || window.CURRENT_USER?.id || '').trim();
  }

  function currentUserChatId(){
    const explicit = String(window.CURRENT_USER?.chatId || '').trim();
    if(explicit) return explicit;
    const rawId = currentUserRawId();
    return rawId ? toChatId(currentUserType(), rawId) : '';
  }

  function contactsStorageKey(){
    const type = currentUserType();
    const raw = currentUserRawId() || 'unknown';
    return `chat_prefs_${type}_${raw}`;
  }

  function loadConversationPrefsLocal(){
    try{
      const raw = localStorage.getItem(contactsStorageKey());
      if(!raw){ conversationPrefs = { pinned: {}, muted: {}, deleted: {} }; return; }
      const parsed = JSON.parse(raw || '{}');
      conversationPrefs = {
        pinned: parsed.pinned || {},
        muted: parsed.muted || {},
        deleted: parsed.deleted || {}
      };
    }catch(e){
      conversationPrefs = { pinned: {}, muted: {}, deleted: {} };
    }
  }

  function saveConversationPrefsLocal(){
    try{ localStorage.setItem(contactsStorageKey(), JSON.stringify(conversationPrefs)); }catch(e){}
  }

  async function loadConversationPrefs(){
    loadConversationPrefsLocal();
    const userType = currentUserType();
    const userId = currentUserRawId();
    if(!userId) return;
    try{
      const res = await apiFetch(`/api/messaging-preferences/${encodeURIComponent(userType)}/${encodeURIComponent(userId)}`, { cache: 'no-store' });
      if(!res.ok) return;
      const payload = await res.json();
      const prefs = payload?.preferences;
      if(prefs && typeof prefs === 'object'){
        conversationPrefs = {
          pinned: prefs.pinned || {},
          muted: prefs.muted || {},
          deleted: prefs.deleted || {}
        };
        saveConversationPrefsLocal();
      }
    }catch(_e){
      // local fallback remains active
    }
  }

  // fetch groups that the current user belongs to and add them to CONTACTS
  async function loadGroups(){
    if(!currentUserChatId()) return;
    try{
      const res = await apiFetch(`/api/messaging/groups?userId=${encodeURIComponent(currentUserChatId())}`, { cache: 'no-store' });
      if(!res.ok) return;
      const payload = await res.json();
      const groupsArr = payload?.groups || [];
      groupsArr.forEach(g => {
        const key = `${GROUP_PREFIX}${g.id}`;
        GROUPS[g.id] = { id: g.id, name: g.name, members: g.members || [] };
        CONTACTS[key] = { id: key, name: g.name, online: false, type: 'group', members: g.members || [] };
      });
    }catch(e){
      console.warn('Failed to load groups', e);
    }
  }


  async function persistConversationPref(peerId, patch){
    const userType = currentUserType();
    const userId = currentUserRawId();
    if(!userId) return;
    try{
      await apiFetch(`/api/messaging-preferences/${encodeURIComponent(userType)}/${encodeURIComponent(userId)}/${encodeURIComponent(String(peerId))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch || {})
      });
    }catch(_e){
      // keep local fallback only
    }
  }

  function isPinned(peerId){ return !!conversationPrefs?.pinned?.[String(peerId)]; }
  function isMuted(peerId){ return !!conversationPrefs?.muted?.[String(peerId)]; }
  function isDeleted(peerId){ return !!conversationPrefs?.deleted?.[String(peerId)]; }

  function setPinned(peerId, pinned){
    const key = String(peerId);
    if(pinned) conversationPrefs.pinned[key] = true;
    else delete conversationPrefs.pinned[key];
    saveConversationPrefsLocal();
    persistConversationPref(key, { pinned: !!pinned });
    renderConversations();
    refreshConversationActionButtons();
  }

  function setMuted(peerId, muted){
    const key = String(peerId);
    if(muted){
      conversationPrefs.muted[key] = true;
      if(conversations[key]) conversations[key].unread = 0;
    } else {
      delete conversationPrefs.muted[key];
    }
    saveConversationPrefsLocal();
    persistConversationPref(key, { muted: !!muted });
    updateBadge();
    renderConversations();
    refreshConversationActionButtons();
  }

  function deleteConversation(peerId){
    const key = String(peerId);
    if(pendingDeletePeer === key){
      pendingDeletePeer = null;
      if(pendingDeleteTimer){
        clearTimeout(pendingDeleteTimer);
        pendingDeleteTimer = null;
      }
    }
    conversationPrefs.deleted[key] = true;
    const contact = CONTACTS[key] || TEACHERS.find(t => String(t.id) === key);
    conversations[key] = {
      peerId: key,
      name: contact?.name || conversations[key]?.name || key,
      msgs: [],
      lastMessage: '',
      lastTs: 0,
      unread: 0,
      online: !!contact?.online
    };
    renderMessages();
    saveConversationPrefsLocal();
    persistConversationPref(key, { deleted: true });
    updateBadge();
    renderConversations();
    refreshConversationActionButtons();
  }

  function clearPendingDeleteConfirmation(){
    pendingDeletePeer = null;
    if(pendingDeleteTimer){
      clearTimeout(pendingDeleteTimer);
      pendingDeleteTimer = null;
    }
  }

  function requestDeleteConversation(peerId){
    const key = String(peerId || '');
    if(!key) return;

    if(pendingDeletePeer === key){
      clearPendingDeleteConfirmation();
      deleteConversation(key);
      return;
    }

    pendingDeletePeer = key;
    const contact = CONTACTS[key] || TEACHERS.find(t => String(t.id) === key);
    conversations[key] = {
      peerId: key,
      name: contact?.name || conversations[key]?.name || key,
      msgs: [],
      lastMessage: '',
      lastTs: 0,
      unread: 0,
      online: !!contact?.online
    };
    renderMessages();
    pendingDeleteTimer = setTimeout(() => {
      if(pendingDeletePeer === key) {
        pendingDeletePeer = null;
        pendingDeleteTimer = null;
        refreshConversationActionButtons();
      }
    }, 5000);
    refreshConversationActionButtons();
  }

  function restoreConversation(peerId){
    const key = String(peerId);
    if(conversationPrefs.deleted[key]){
      delete conversationPrefs.deleted[key];
      saveConversationPrefsLocal();
      persistConversationPref(key, { deleted: false });
    }
  }

  async function loadContacts(){
    const selfId = currentUserChatId();
    const role = currentUserType();
    // load admins for all users so every role can message any other
    const shouldLoadAdmins = true;
    const contactList = [];

    try{
      const teacherRes = await apiFetch('/api/teachers', { cache: 'no-store' });
      if(teacherRes.ok){
        const data = await teacherRes.json();
        (data || []).forEach(t => {
          const rawId = String(t.id || t.teacherId || t.teacher_id || '');
          const id = rawId ? toChatId('teacher', rawId) : '';
          if(!id || id === selfId) return;
          contactList.push({
            id,
            rawId,
            name: t.name || t.fullName || `${t.firstName||''} ${t.lastName||''}`.trim() || t.email || `Teacher ${id}`,
            email: t.email || t.emailAddress || null,
            avatar: t.avatar || t.photo || null,
            online: !!t.online,
            role: t.role || 'teacher',
            type: 'teacher'
          });
        });
      }
    }catch(err){
      console.warn('Could not load teacher contacts', err);
    }

    if(shouldLoadAdmins){
      try{
        const adminRes = await apiFetch('/api/admin/contacts-public', { cache: 'no-store' });
        const fallbackAdminRes = (!adminRes.ok) ? await apiFetch('/api/admin/contacts', { cache: 'no-store' }) : adminRes;
        if(fallbackAdminRes.ok){
          const data = await fallbackAdminRes.json();
          const admins = Array.isArray(data?.admins) ? data.admins : [];
          admins.forEach(a => {
            const rawId = String(a.id || a.adminId || a.admin_id || '');
            const id = rawId ? toChatId('admin', rawId) : '';
            if(!id || id === selfId) return;
            const contact = {
              id,
              rawId,
              name: a.name || a.email || `Admin ${id}`,
              email: a.email || null,
              avatar: null,
              online: !!a.online,
              role: a.role || 'admin',
              type: 'admin'
            };
            if(shouldHideAdminContact(contact)) return;
            contactList.push(contact);
          });
        }
      }catch(err){
        console.warn('Could not load admin contacts', err);
      }
    }

    TEACHERS = contactList;
    // clear only non-group contacts to avoid wiping conversation data for existing groups
    Object.keys(CONTACTS).forEach(k => {
      if (!String(k).startsWith(GROUP_PREFIX)) delete CONTACTS[k];
    });
    contactList.forEach(c => { CONTACTS[c.id] = Object.assign({}, c); });
    renderConversations();
  }

  // Attempt to resolve the real authenticated user id from auth endpoints
  async function resolveCurrentUser(){
    const hintedType = normalizeUserType(window.CURRENT_USER?.role);

    const tryResolveTeacherStorage = () => {
      try{
        let teacher = null;
        if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
          teacher = sessionManager.getTabSession('teacherData') || sessionManager.getTabSession('adviserData');
        }
        if(!teacher){
          const teacherRaw = sessionStorage.getItem('teacherData')
            || sessionStorage.getItem('adviserData')
            || localStorage.getItem('loggedInUser');
          if(teacherRaw) teacher = JSON.parse(teacherRaw || '{}');
        }
        if(teacher && teacher.id){
          window.CURRENT_USER.rawId = String(teacher.id);
          window.CURRENT_USER.id = String(teacher.id);
          window.CURRENT_USER.userType = 'teacher';
          window.CURRENT_USER.chatId = toChatId('teacher', teacher.id);
          window.CURRENT_USER.name = teacher.name || teacher.full_name || window.CURRENT_USER.name;
          window.CURRENT_USER.role = teacher.role || window.CURRENT_USER.role || 'teacher';
          return true;
        }
      }catch(_e){}
      return false;
    };

    const tryResolveAdminStorage = () => {
      try{
        let admin = null;
        if (typeof sessionManager !== 'undefined' && sessionManager.getTabSession) {
          admin = sessionManager.getTabSession('adminData');
        }
        if(!admin){
          const adminRaw = localStorage.getItem('adminData');
          if(adminRaw) admin = JSON.parse(adminRaw || '{}');
        }
        if(admin && admin.id){
          window.CURRENT_USER.rawId = String(admin.id);
          window.CURRENT_USER.id = String(admin.id);
          window.CURRENT_USER.userType = 'admin';
          window.CURRENT_USER.chatId = toChatId('admin', admin.id);
          window.CURRENT_USER.name = admin.name || window.CURRENT_USER.name;
          window.CURRENT_USER.role = 'admin';
          return true;
        }
      }catch(_e){}
      return false;
    };

    if (hintedType === 'admin') {
      if (tryResolveAdminStorage()) return;
      if (tryResolveTeacherStorage()) return;
    } else {
      if (tryResolveTeacherStorage()) return;
      if (tryResolveAdminStorage()) return;
    }

    let resolved = false;
    try{
      const endpoints = [
        '/api/teacher-auth/profile','/api/teacher-auth/me','/api/teacher-auth/session','/api/teacher-auth/whoami',
        '/api/adviser-auth/me', '/api/adviser-auth/profile', '/api/adviser-auth/session',
        '/api/admin/me', '/api/admin/profile', '/api/admin-auth/me', '/api/admin-auth/profile'
      ];
      for(const ep of endpoints){
        try{
          const res = await apiFetch(ep, { cache: 'no-store' });
          if(!res.ok) continue;
          const body = await res.json();
          // body may contain teacher, adviser, user, or id field
          const candidate = body.teacher || body.adviser || body.admin || body.user || body;
          if(candidate){
            const id = candidate.id || candidate.teacherId || candidate.teacher_id || candidate.adviserId || candidate.adviser_id || candidate.adminId || candidate.admin_id || candidate.userId || candidate.uid || candidate._id;
            const name = candidate.name || candidate.fullName || candidate.fullname || `${candidate.firstName||''} ${candidate.lastName||''}`.trim() || candidate.email;
            const email = candidate.email || candidate.emailAddress || null;
            if(id){
              const resolvedRole = candidate.role || candidate.type || window.CURRENT_USER.role || '';
              const userType = normalizeUserType(resolvedRole || (ep.includes('/api/admin') ? 'admin' : 'teacher'));
              window.CURRENT_USER.rawId = String(id);
              window.CURRENT_USER.id = String(id);
              window.CURRENT_USER.userType = userType;
              window.CURRENT_USER.chatId = toChatId(userType, id);
              resolved=true;
            }
            if(name) window.CURRENT_USER.name = name;
            console.info(`Resolved current user from ${ep}: id=${window.CURRENT_USER.chatId || window.CURRENT_USER.id}, name=${window.CURRENT_USER.name}`);
            if(email && !TEACHERS.find(t=>String(t.rawId)===String(id))){
              const t = TEACHERS.find(x=>x.email && x.email.toLowerCase()===email.toLowerCase());
              if(t){
                window.CURRENT_USER.rawId = String(t.rawId || t.id || id);
                window.CURRENT_USER.id = String(window.CURRENT_USER.rawId);
                window.CURRENT_USER.userType = normalizeUserType(t.type || t.role || 'teacher');
                window.CURRENT_USER.chatId = t.id || toChatId(window.CURRENT_USER.userType, window.CURRENT_USER.rawId);
                if(!window.CURRENT_USER.name) window.CURRENT_USER.name = t.name;
                console.info(`Remapped user to: id=${window.CURRENT_USER.chatId}`);
              }
            }
            return;
          }
        }catch(e){ /* ignore and try next */ }
      }
    }catch(e){ console.warn('resolveCurrentUser failed', e); }
    // Fallback: try to match by visible name in page (e.g., profile name displayed in header)
    if(!resolved){
      let visibleName = null;
      // Check adviser profile name
      const adviserName = document.getElementById('adviserProfileName')?.textContent?.trim();
      // Check admin name  
      const adminName = document.getElementById('adminName')?.textContent?.trim();
      visibleName = adviserName || adminName;
      if(visibleName && visibleName !== 'Adviser' && visibleName !== 'Admin'){
        // Try to find a teacher with matching name
        const match = TEACHERS.find(t => t.name && t.name.toUpperCase() === visibleName.toUpperCase());
        if(match){
          window.CURRENT_USER.rawId = String(match.rawId || match.id);
          window.CURRENT_USER.id = String(window.CURRENT_USER.rawId);
          window.CURRENT_USER.userType = normalizeUserType(match.type || match.role || 'teacher');
          window.CURRENT_USER.chatId = match.id || toChatId(window.CURRENT_USER.userType, window.CURRENT_USER.rawId);
          window.CURRENT_USER.name = match.name;
          console.info(`Resolved current user by name match: id=${window.CURRENT_USER.chatId}, name=${window.CURRENT_USER.name}`);
          return;
        }
      }
    }
    // Last ditch fallback: use a pseudo-ID based on visible name to avoid all messages being "me"
    if(!window.CURRENT_USER.id && !window.CURRENT_USER.chatId){
      const adviserName = document.getElementById('adviserProfileName')?.textContent?.trim();
      const adminName = document.getElementById('adminName')?.textContent?.trim();
      const visibleName = adviserName || adminName;
      const fallbackType = normalizeUserType(window.CURRENT_USER.role || 'teacher');
      if(visibleName && visibleName !== 'Adviser' && visibleName !== 'Admin'){
        window.CURRENT_USER.rawId = 'user:' + visibleName.toLowerCase().replace(/\s+/g, '');
        window.CURRENT_USER.id = window.CURRENT_USER.rawId;
        window.CURRENT_USER.userType = fallbackType;
        window.CURRENT_USER.chatId = toChatId(fallbackType, window.CURRENT_USER.rawId);
        console.warn(`Could not resolve user ID from API/DB, using pseudo-ID: ${window.CURRENT_USER.chatId}`);
      } else {
        window.CURRENT_USER.rawId = 'user:unknown';
        window.CURRENT_USER.id = window.CURRENT_USER.rawId;
        window.CURRENT_USER.userType = fallbackType;
        window.CURRENT_USER.chatId = toChatId(fallbackType, window.CURRENT_USER.rawId);
        console.warn(`Could not resolve user ID or form, using fallback:`, window.CURRENT_USER);
      }
    }
  }

  function el(id){return document.getElementById(id)}

  function formatTs(ts){const d=new Date(ts);return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});} 

  function formatConversationTs(ts){
    if(!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if(sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function getInitials(nameValue){
    const raw = String(nameValue || '').trim();
    if(!raw) return 'NA';
    const parts = raw.split(/\s+/).filter(Boolean);
    if(parts.length >= 2){
      return `${(parts[0][0] || '').toUpperCase()}${(parts[1][0] || '').toUpperCase()}` || 'NA';
    }
    const compact = parts[0] || raw;
    const first = (compact[0] || '').toUpperCase();
    const second = (compact[1] || '').toUpperCase();
    return (first + second) || 'NA';
  }

  function getConnectionStateEl(){ return el('chatConnectionState'); }

  function setConnectionState(state, label){
    const stateEl = getConnectionStateEl();
    if(!stateEl) return;
    stateEl.classList.remove('connected', 'connecting', 'disconnected');
    stateEl.classList.add(state);
    stateEl.textContent = label;
  }

  function setPanelOpen(isOpen){
    const panel = el('chatPanel');
    if(!panel) return;
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    panel.style.display = isOpen ? 'flex' : 'none';
    panel.style.pointerEvents = isOpen ? 'auto' : 'none';
    panel.style.right = isOpen ? '0' : '';
    if(!isOpen){
      panel.setAttribute('data-conversation-active', 'false');
      currentPeer = null;
      renderConversations();
      renderMessages();
    }
  }

  function togglePanelFromIcon(){
    const panel = el('chatPanel');
    if(!panel) return;
    const shouldOpen = panel.getAttribute('aria-hidden') !== 'false';
    setPanelOpen(shouldOpen);
  }

  function renderConversations(){
    const list = el('conversationsList'); if(!list) return;
    list.innerHTML='';
    const selfChatId = String(currentUserChatId() || '');
    // Flatten contacts from CONTACTS map so admins (or other senders) appear even if not in TEACHERS
    const contacts = Object.values(CONTACTS || {}).filter(c => String(c.id || '') !== selfChatId);
    // sort by last activity (lastTs in conversations) falling back to name
    contacts.sort((a,b)=>{
      const aPinned = isPinned(a.id) ? 1 : 0;
      const bPinned = isPinned(b.id) ? 1 : 0;
      if(aPinned !== bPinned) return bPinned - aPinned;
      const aLast = conversations[a.id]?.lastTs || 0;
      const bLast = conversations[b.id]?.lastTs || 0;
      if(aLast !== bLast) return bLast - aLast;
      return (a.name||'').localeCompare(b.name||'');
    });

    const searchNeedle = (currentSearch || '').trim().toLowerCase();
    const filteredContacts = contacts.filter(t => {
      const conv = conversations[t.id] || { unread: 0 };
      if(currentFilter === 'unread' && isMuted(t.id)) return false;
      if(currentFilter === 'unread' && !(conv.unread > 0)) return false;
      if(currentFilter === 'online' && !t.online) return false;
      if(searchNeedle){
        // include member names for groups
        const memberNames = (t.members || []).map(mid=>CONTACTS[mid]?.name||mid).join(' ');
        const haystack = `${t.name || ''} ${memberNames} ${t.email || ''} ${conv.lastMessage || ''}`.toLowerCase();
        if(!haystack.includes(searchNeedle)) return false;
      }
      return true;
    });

    if(filteredContacts.length === 0){
      const empty = document.createElement('div');
      empty.className = searchNeedle ? 'chat-empty-search' : 'chat-empty-list';
      empty.textContent = searchNeedle ? 'No conversation matches your search.' : 'No conversations available.';
      list.appendChild(empty);
      return;
    }

    filteredContacts.forEach(t => {
      const conv = conversations[t.id] || { peerId: t.id, name: t.name, msgs: [], lastTs: 0, unread: 0 };
      const item = document.createElement('div'); item.className='conversation-item'; item.dataset.peer=t.id;
      if(t.id === currentPeer) item.classList.add('active');
      if(isPinned(t.id)) item.classList.add('pinned');
      if(isMuted(t.id)) item.classList.add('muted');
      const avatarWrap = document.createElement('div'); avatarWrap.className='avatar-wrap';
      if(t.avatar){ const img = document.createElement('img'); img.src = t.avatar; img.className='avatar-img'; avatarWrap.appendChild(img);} else if(String(t.id).startsWith(GROUP_PREFIX)) {
        avatarWrap.textContent = '👥';
      } else {
        avatarWrap.textContent = getInitials(t.name || t.id || 'NA');
      }
      const meta = document.createElement('div'); meta.className='meta';
      const row = document.createElement('div'); row.className='row';
      const title = document.createElement('div'); title.className='name'; title.textContent = t.name || t.id;
      const presence = document.createElement('div'); presence.className='presence-dot '+(t.online ? 'presence-online' : 'presence-offline');
      row.appendChild(title); row.appendChild(presence);
      const lastRow = document.createElement('div'); lastRow.className='sub-row';
      const last = document.createElement('div'); last.className='sub'; last.textContent = conv.lastMessage || 'No messages yet';
      const flags = document.createElement('div'); flags.className='meta-flags';
      if(isPinned(t.id)){
        const pinFlag = document.createElement('span');
        pinFlag.className = 'flag-pill';
        pinFlag.textContent = 'Pinned';
        flags.appendChild(pinFlag);
      }
      if(isMuted(t.id)){
        const muteFlag = document.createElement('span');
        muteFlag.className = 'flag-pill';
        muteFlag.textContent = 'Muted';
        flags.appendChild(muteFlag);
      }
      const ts = document.createElement('div'); ts.className='msg-time'; ts.textContent = formatConversationTs(conv.lastTs || 0);
      if(flags.childNodes.length) lastRow.appendChild(flags);
      lastRow.appendChild(last);
      lastRow.appendChild(ts);
      meta.appendChild(row); meta.appendChild(lastRow);
      item.appendChild(avatarWrap); item.appendChild(meta);
      if(conv.unread && !isMuted(t.id)){const b=document.createElement('div');b.className='unread-badge';b.textContent=conv.unread;item.appendChild(b)}
      item.addEventListener('click', ()=>{ openConversation(t.id); });
      list.appendChild(item);
    });
  }

  function openConversation(peerId){
    console.log(`openConversation called with peerId: ${peerId}`);
    clearPendingDeleteConfirmation();
    currentPeer = peerId;
    const isGroup = String(peerId).startsWith(GROUP_PREFIX);
    let conv = conversations[peerId];
    if(!conv){
      let displayName = peerId;
      if(isGroup){
        const gid = Number(peerId.slice(GROUP_PREFIX.length));
        displayName = (GROUPS[gid] && GROUPS[gid].name) || peerId;
      } else {
        const teacher = CONTACTS[peerId] || TEACHERS.find(t=>t.id===peerId);
        if(teacher) displayName = teacher.name;
      }
      conv = { peerId, name: displayName, msgs: [] };
    }
    // ensure conv.name is up to date
    if(isGroup){
      const gid = Number(peerId.slice(GROUP_PREFIX.length));
      conv.name = (GROUPS[gid] && GROUPS[gid].name) || conv.name;
    }
    conversations[peerId]=conv;
    conv.unread=0;
    // Mark that we have an active conversation
    const panel = el('chatPanel');
    if(panel) {
      panel.setAttribute('data-conversation-active', 'true');
      console.log(`Set data-conversation-active to true on panel`);
    }
    updateBadge(); 
    renderConversations(); 
    renderMessages();
    refreshConversationActionButtons();
    // Focus on input field after rendering
    setTimeout(() => {
      const input = el('chatMessageInput');
      if(input) {
        input.focus();
        console.log(`Focused input field`);
      }
    }, 100);
  }

  function closeConversation(){
    clearPendingDeleteConfirmation();
    currentPeer = null;
    const panel = el('chatPanel');
    if(panel) panel.setAttribute('data-conversation-active', 'false');
    refreshConversationActionButtons();
    renderConversations(); renderMessages();
  }

  function refreshConversationActionButtons(){
    const pinBtn = el('chatPinBtn');
    const muteBtn = el('chatMuteBtn');
    const deleteBtn = el('chatDeleteBtn');
    const hasPeer = !!currentPeer;
    if(pinBtn){
      pinBtn.disabled = !hasPeer;
      pinBtn.classList.toggle('active', hasPeer && isPinned(currentPeer));
      pinBtn.textContent = hasPeer && isPinned(currentPeer) ? 'Unpin' : 'Pin';
    }
    if(muteBtn){
      muteBtn.disabled = !hasPeer;
      muteBtn.classList.toggle('active', hasPeer && isMuted(currentPeer));
      muteBtn.textContent = hasPeer && isMuted(currentPeer) ? 'Unmute' : 'Mute';
    }
    if(deleteBtn){
      deleteBtn.disabled = !hasPeer;
      const isPendingDelete = hasPeer && pendingDeletePeer === currentPeer;
      deleteBtn.classList.toggle('active', isPendingDelete);
      deleteBtn.textContent = isPendingDelete ? 'Delete conversation' : 'Delete';
      deleteBtn.title = isPendingDelete ? 'Delete conversation' : 'Delete conversation';
    }
    const addMemberBtnEl = el('chatAddMemberBtn');
    if(addMemberBtnEl){
      const isGroup = hasPeer && String(currentPeer).startsWith(GROUP_PREFIX);
      addMemberBtnEl.disabled = !isGroup;
    }
  }

  function markAllConversationsRead(){
    Object.values(conversations).forEach(conv => {
      if(conv) conv.unread = 0;
    });
    updateBadge();
    renderConversations();
  }

  function renderMessages(){
    const c = el('messagesContainer'); 
    if(!c) return; 
    c.innerHTML='';
    if(!currentPeer){
      el('chatWindowTitle').textContent='Select a conversation'; 
      return;
    }
    const conv = conversations[currentPeer];
    const teacher = CONTACTS[currentPeer] || TEACHERS.find(t=>t.id===currentPeer);
    console.log(`renderMessages: currentPeer=${currentPeer}, teacher=${teacher?.name}, msgs=${conv?.msgs?.length||0}`);
    
    // clear and rebuild header with profile info
    const headerTitle = el('chatWindowTitle');
    const headerStatus = el('chatWindowStatus');
    
    const isGroup = String(currentPeer).startsWith(GROUP_PREFIX);
    if(headerTitle){
      headerTitle.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '10px';
      wrapper.style.flex = '1';

      const avatar = document.createElement('div');
      avatar.style.width = '40px';
      avatar.style.height = '40px';
      avatar.style.borderRadius = '50%';
      avatar.style.background = 'linear-gradient(135deg, #1e5631 0%, #40916c 100%)';
      avatar.style.display = 'flex';
      avatar.style.alignItems = 'center';
      avatar.style.justifyContent = 'center';
      avatar.style.fontWeight = '700';
      avatar.style.color = 'white';
      avatar.style.fontSize = '14px';
      avatar.style.flexShrink = '0';

      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '2px';
      info.style.flex = '1';

      if(isGroup){
        const gid = Number(currentPeer.slice(GROUP_PREFIX.length));
        const grp = GROUPS[gid] || {};
        // group avatar: use initials of name
        avatar.textContent = getInitials(grp.name || currentPeer);

        const nameEl = document.createElement('div');
        nameEl.style.fontWeight = '700';
        nameEl.style.fontSize = '14px';
        nameEl.style.color = 'var(--chat-text)';
        nameEl.textContent = grp.name || currentPeer;

        const statusEl = document.createElement('div');
        statusEl.style.fontSize = '12px';
        statusEl.style.color = 'var(--chat-muted)';
        statusEl.textContent = grp.members && grp.members.length
            ? `Members: ${grp.members.map(id=>CONTACTS[id]?.name||id).join(', ')}`
            : '';

        info.appendChild(nameEl);
        if(statusEl.textContent) info.appendChild(statusEl);
      } else if(teacher){
        if(teacher.avatar){
          const img = document.createElement('img');
          img.src = teacher.avatar;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '50%';
          avatar.appendChild(img);
        } else {
          avatar.textContent = getInitials(teacher.name || teacher.id || 'NA');
        }

        const nameEl = document.createElement('div');
        nameEl.style.fontWeight = '700';
        nameEl.style.fontSize = '14px';
        nameEl.style.color = 'var(--chat-text)';
        nameEl.textContent = teacher.name || 'Unknown';

        const statusEl = document.createElement('div');
        statusEl.style.fontSize = '12px';
        statusEl.style.color = 'var(--chat-muted)';
        statusEl.textContent = (teacher && teacher.online) ? 'Online' : 'Offline';

        info.appendChild(nameEl);
        info.appendChild(statusEl);
      } else {
        // fallback simple title
        avatar.textContent = getInitials(conv.name || conv.peerId);
        const nameEl = document.createElement('div');
        nameEl.style.fontWeight = '700';
        nameEl.style.fontSize = '14px';
        nameEl.style.color = 'var(--chat-text)';
        nameEl.textContent = conv.name || conv.peerId;
        info.appendChild(nameEl);
      }

      wrapper.appendChild(avatar);
      wrapper.appendChild(info);
      headerTitle.appendChild(wrapper);
    }
    if(headerStatus) {
      headerStatus.style.display = 'none'; // status is now part of title area
    }

    refreshConversationActionButtons();
    
    // Render existing messages
    if(conv.msgs && conv.msgs.length > 0){
      const msgs = dedupeMessages(conv.msgs).sort((a,b)=> (Number(a.ts||0) - Number(b.ts||0)) );
      msgs.forEach(m=>{
        // normalize message fields and determine ownership robustly
        const mFrom = String(m.from || m.fromId || m.sender || m.senderId || '');
        const mTo = String(m.to || m.toId || m.recipient || m.recipientId || '');
        const mText = m.text || m.body || m.message || '';
        const mTs = m.ts || m.ts_ms || m.createdAt || m.time || Date.now();
        const isMine = String(currentUserChatId()) === mFrom;
        const mEl = document.createElement('div');
        mEl.className='message '+(isMine ? 'me' : 'them');
        mEl.innerHTML = `<div class="body">${escapeHtml(mText)}</div><span class="ts">${formatTs(mTs)}</span>`;
        c.appendChild(mEl);
      });
    } else {
      // Show "no messages yet" placeholder
      const emptyMsg = document.createElement('div');
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.color = 'var(--chat-muted)';
      emptyMsg.style.padding = '40px 20px';
      emptyMsg.style.fontSize = '13px';
      emptyMsg.textContent = 'No messages yet. Start the conversation!';
      c.appendChild(emptyMsg);
    }
    c.scrollTop = c.scrollHeight;
  }

  function escapeHtml(s){return (s+'').replace(/[&<>"']/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" })[ch])}

  function updateBadge(){
    const total = Object.entries(conversations).reduce((sum,[peer,c])=>{
      if(isMuted(peer)) return sum;
      return sum + (c.unread || 0);
    },0);
    const b = el('chatBadge'); if(!b) return; if(total>0){b.style.display='inline-block'; b.textContent=total}else b.style.display='none';
  }

  function showNewConversationDialog(){
    // build a simple modal overlay listing contacts with checkboxes and group name input
    let existing = document.getElementById('chatNewModal');
    if(existing){ existing.style.display='flex'; existing.querySelector('input[name="groupName"]').focus(); return; }
    const modal = document.createElement('div');
    modal.id = 'chatNewModal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000';
    const box = document.createElement('div');
    box.style.background = 'var(--chat-bg)';
    box.style.padding = '20px';
    box.style.borderRadius = '8px';
    box.style.maxWidth = '400px';
    box.style.width = '90%';
    box.style.maxHeight = '80vh';
    box.style.overflowY = 'auto';
    const title = document.createElement('h3');
    title.textContent = 'New Conversation';
    box.appendChild(title);
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Group name (optional for one-on-one):';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.name = 'groupName';
    nameInput.style.width='100%';
    nameInput.style.margin='8px 0 12px';
    box.appendChild(nameLabel);
    box.appendChild(nameInput);
    const list = document.createElement('div');
    list.style.maxHeight='300px';
    list.style.overflowY='auto';
    Object.values(CONTACTS).forEach(c=>{
      // skip groups in selection list
      if(String(c.id).startsWith(GROUP_PREFIX)) return;
      const row = document.createElement('div');
      row.style.display='flex';
      row.style.alignItems='center';
      row.style.gap='8px';
      row.style.marginBottom='6px';
      const chk = document.createElement('input');
      chk.type='checkbox';
      chk.value = c.id;
      row.appendChild(chk);
      const lbl = document.createElement('span');
      lbl.textContent = c.name || c.id;
      row.appendChild(lbl);
      list.appendChild(row);
    });
    box.appendChild(list);
    const btnRow = document.createElement('div');
    btnRow.style.display='flex';
    btnRow.style.justifyContent='flex-end';
    btnRow.style.gap='10px';
    btnRow.style.marginTop='12px';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent='Cancel';
    cancelBtn.addEventListener('click', ()=>{ modal.remove(); });
    const startBtn = document.createElement('button');
    startBtn.textContent='Start';
    startBtn.addEventListener('click', async ()=>{
      const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(ch=>ch.value);
      if(selected.length===0){ alert('Please choose at least one contact'); return; }
      const groupName = nameInput.value.trim();
      modal.remove();
      if(selected.length === 1){
        openConversation(selected[0]);
      } else {
        let group;
        try{
          group = await createGroup(groupName || 'New Group', selected);
        }catch(e){
          console.error('failed to create group', e);
          alert('Could not create group');
          return;
        }
        const key = `${GROUP_PREFIX}${group.groupId}`;
        CONTACTS[key] = { id:key, name: group.name, online:false, members: group.members };
        GROUPS[group.groupId] = { id: group.groupId, name: group.name, members: group.members };
        openConversation(key);
      }
    });
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(startBtn);
    box.appendChild(btnRow);
    modal.appendChild(box);
    document.body.appendChild(modal);
    nameInput.focus();
  }

  async function createGroup(name, members){
    const payload = { name: String(name||''), members: members || [], creatorId: currentUserChatId() };
    const res = await apiFetch('/api/messaging/groups', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('create group failed');
    return await res.json();
  }

  async function addMembersToGroup(groupId, newMembers){
    const res = await apiFetch(`/api/messaging/groups/${encodeURIComponent(groupId)}/members`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ members: newMembers })
    });
    if(!res.ok) throw new Error('failed to add members');
    return await res.json();
  }

  function showAddMembersDialog(){
    if(!currentPeer || !String(currentPeer).startsWith(GROUP_PREFIX)) return;
    const gid = Number(currentPeer.slice(GROUP_PREFIX.length));
    const grp = GROUPS[gid] || {};
    const existing = new Set((grp.members||[]).map(String));
    let modal = document.getElementById('chatAddModal');
    if(modal){ modal.style.display = 'flex'; return; }
    modal = document.createElement('div');
    modal.id='chatAddModal';
    modal.style.position='fixed'; modal.style.top='0'; modal.style.left='0';
    modal.style.width='100vw'; modal.style.height='100vh';
    modal.style.background='rgba(0,0,0,0.5)'; modal.style.display='flex';
    modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.zIndex='1001';
    const box=document.createElement('div');
    box.style.background='var(--chat-bg)'; box.style.padding='20px'; box.style.borderRadius='8px';
    box.style.maxWidth='400px'; box.style.width='90%'; box.style.maxHeight='80vh'; box.style.overflowY='auto';
    const title=document.createElement('h3'); title.textContent='Add Members to "'+(grp.name||'Group')+'"'; box.appendChild(title);
    const list=document.createElement('div'); list.style.maxHeight='300px'; list.style.overflowY='auto';
    Object.values(CONTACTS).forEach(c=>{
      if(String(c.id).startsWith(GROUP_PREFIX)) return;
      if(existing.has(String(c.id))) return;
      const row=document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px'; row.style.marginBottom='6px';
      const chk=document.createElement('input'); chk.type='checkbox'; chk.value=c.id; row.appendChild(chk);
      const lbl=document.createElement('span'); lbl.textContent=c.name||c.id; row.appendChild(lbl);
      list.appendChild(row);
    });
    box.appendChild(list);
    const btnRow=document.createElement('div'); btnRow.style.display='flex'; btnRow.style.justifyContent='flex-end'; btnRow.style.gap='10px'; btnRow.style.marginTop='12px';
    const cancelBtn=document.createElement('button'); cancelBtn.textContent='Cancel'; cancelBtn.addEventListener('click',()=>modal.remove());
    const addBtn=document.createElement('button'); addBtn.textContent='Add'; addBtn.addEventListener('click', async()=>{
      const selected=Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(ch=>ch.value);
      if(selected.length===0){ modal.remove(); return; }
      try{
        await addMembersToGroup(gid, selected);
        grp.members = grp.members.concat(selected);
        CONTACTS[currentPeer].members = grp.members;
        alert('Members added');
        // if this conversation is currently open, re-render header info
        if(currentPeer === `${GROUP_PREFIX}${gid}`){
          renderMessages();
        }
      }catch(e){ console.error(e); alert('Failed to add members'); }
      modal.remove();
    });
    btnRow.appendChild(cancelBtn); btnRow.appendChild(addBtn);
    box.appendChild(btnRow);
    modal.appendChild(box);
    document.body.appendChild(modal);
  }

  function ensureWs(){
    // Don't attempt to connect if user ID is not yet resolved
    if(!currentUserChatId()){
      console.warn('Waiting for user ID to be resolved...', window.CURRENT_USER);
      setTimeout(ensureWs, 500);
      return;
    }
    if(ws && ws.readyState===WebSocket.OPEN) return;
    setConnectionState('connecting', 'Connecting');
    console.info('Connecting to messaging server with user ID:', currentUserChatId());
    ws = new WebSocket(WS_URL);
    ws.addEventListener('open', ()=>{
      ws.send(JSON.stringify({
        type:'auth',
        user: {
          id: currentUserChatId(),
          rawId: currentUserRawId(),
          userType: currentUserType(),
          role: window.CURRENT_USER.role,
          name: window.CURRENT_USER.name,
          tenantCode: TENANT_CODE,
          school: TENANT_CODE
        }
      }));
      console.info('Messaging: authenticated as', currentUserChatId(), window.CURRENT_USER.name);
      setConnectionState('connected', 'Connected');
    });
    ws.addEventListener('message', ev=>{
      try{const msg = JSON.parse(ev.data); handleServerMessage(msg)}catch(e){console.warn(e)}
    });
    ws.addEventListener('error', ()=>{
      setConnectionState('disconnected', 'Disconnected');
    });
    ws.addEventListener('close', ()=>{
      setConnectionState('disconnected', 'Disconnected');
      console.info('Messaging: disconnected'); setTimeout(ensureWs,2000);
    });
  }

  // Attempt to fetch conversation history from common REST endpoints.
  // This is resilient: tries several endpoint patterns and normalizes results
  async function fetchConversationHistory(){
    if(!window.CURRENT_USER || !currentUserChatId()) return;
    // make sure group metadata is available before processing history
    await loadGroups();
    const userId = encodeURIComponent(currentUserChatId());
    const tryEndpoints = [
      `/api/messaging/conversations?userId=${userId}`,
      `/api/conversations?userId=${userId}`,
      `/api/messages?userId=${userId}`,
      `/api/chat/conversations?userId=${userId}`,
      `/api/chat/messages?userId=${userId}`
    ];
    // also attempt to load groups first so we can correctly interpret history entries

    for(const ep of tryEndpoints){
      try{
        const res = await apiFetch(ep, {cache:'no-store'});
        if(!res.ok) continue;
        const body = await res.json();
        // body might be: {conversations: [...] } or an array of conversations or messages
        let data = body;
        if(body && body.conversations && Array.isArray(body.conversations)) data = body.conversations;

        if(Array.isArray(data) && data.length){
          // Determine if entries are conversation objects (have peerId/msg list) or flat messages
          if(data[0].peerId || data[0].msgs){
            data.forEach(c=>{ conversations[c.peerId||c.id] = Object.assign({unread:0}, c); });
          } else if(data[0].from && data[0].to){
            // messages array - group by peer
            data.forEach(m=>{
              const from = String(m.from || m.fromId || m.sender || m.senderId || '');
              const to = String(m.to || m.toId || m.recipient || m.recipientId || '');
              const peer = (from === String(currentUserChatId())) ? to : from;
              conversations[peer] = conversations[peer] || {peerId: peer, msgs: [], lastTs: 0, lastMessage: ''};
              const stored = { from, to, text: m.text || m.body || m.message || '', ts: m.ts || m.createdAt || Date.now() };
              conversations[peer].msgs.push(stored);
              conversations[peer].lastTs = Math.max(conversations[peer].lastTs||0, stored.ts || 0);
              conversations[peer].lastMessage = stored.text || conversations[peer].lastMessage;
            });
          }
          // normalize contacts from conversations
          Object.values(conversations).forEach(c=>{ if(c && c.peerId && !CONTACTS[c.peerId]) CONTACTS[c.peerId] = {id:c.peerId, name: c.name || c.peerId, avatar:null, online: !!c.online}; });
          console.info('Conversations after REST load:', Object.keys(conversations).length);
          // merge any locally-stored messages (fallback) so sent messages survive reload
          mergeLocalMessages();
          // remove any locally-stored messages that the server already returned in history
          try{ pruneLocalStorageAgainstServer(); }catch(e){/*ignore*/}
          renderConversations(); updateBadge();
          console.info('Loaded conversation history from', ep);
          return; // stop after first successful load
        }
      }catch(e){ /* ignore and try next endpoint */ }
    }
    console.info('No conversation REST endpoint responded with history. Waiting for WS init.');
  }

  // Local persistence fallback: save messages per current user to localStorage
  function localStorageKey(){
    const uid = String(currentUserChatId() || 'unknown');
    return `chat_local_${uid}`;
  }

  function saveLocalMessages(){
    try{
      const key = localStorageKey();
      const payload = {};
      // Only persist messages that originate from the current user to avoid duplicating server-provided messages
      const myId = String(currentUserChatId() || '');
      Object.keys(conversations).forEach(peer=>{
        const msgs = (conversations[peer].msgs || []).filter(m => String(m.from || m.fromId || '') === myId).slice(-200);
        if(msgs.length) payload[peer] = msgs;
      });
      localStorage.setItem(key, JSON.stringify(payload));
      console.info('Saved local messages to', key);
    }catch(e){ console.warn('Local save failed', e); }
  }

  function loadLocalMessages(){
    try{
      const key = localStorageKey();
      const raw = localStorage.getItem(key);
      if(!raw) return {};
      return JSON.parse(raw || '{}');
    }catch(e){ console.warn('Local load failed', e); return {}; }
  }

  function dedupeMessages(arr){
    const seen = new Set();
    const out = [];
    arr.forEach(m=>{
      // prefer explicit IDs if provided by server
      const mid = m.id || m._id || m.uuid || m.msgId || null;
      const textSnippet = String(m.text || m.body || m.message || '').slice(0,80).replace(/\s+/g,' ');
      const tsKey = Math.floor((Number(m.ts || m.createdAt || 0))/1000);
      const id = mid ? String(mid) : `${String(m.from||'')}:${String(m.to||'')}:${tsKey}:${textSnippet}`;
      if(!seen.has(id)){
        seen.add(id);
        out.push(m);
      }
    });
    return out;
  }

  // Merge localStorage messages into conversations map without duplicating
  function mergeLocalMessages(){
    const local = loadLocalMessages();
    let merged = false;
    Object.keys(local).forEach(peer=>{
      if(isDeleted(peer)) return;
      const msgs = Array.isArray(local[peer]) ? local[peer] : [];
      if(!conversations[peer]) conversations[peer] = { peerId: peer, msgs: [], lastTs:0 };
      // normalize and append any missing messages
      const existing = conversations[peer].msgs || [];
      const combined = existing.concat(msgs).map(m=>({ from: String(m.from||m.fromId||m.sender||''), to: String(m.to||m.toId||m.recipient||''), text: m.text||m.body||m.message||'', ts: m.ts||m.createdAt||Date.now() }));
      const deduped = dedupeMessages(combined).sort((a,b)=> (a.ts||0)-(b.ts||0));
      conversations[peer].msgs = deduped;
      conversations[peer].lastTs = deduped.length ? deduped[deduped.length-1].ts : (conversations[peer].lastTs||0);
      merged = merged || deduped.length> (existing.length||0);
    });
    if(merged) console.info('Merged local messages into conversations');
  }

  // Remove a locally persisted message that matches a server-stored message
  function removeLocalMessage(peer, match){
    try{
      const key = localStorageKey();
      const raw = localStorage.getItem(key); if(!raw) return;
      const obj = JSON.parse(raw || '{}');
      if(!obj[peer]) return;
      const filtered = (obj[peer]||[]).filter(m=>{
        const sameFrom = String(m.from||m.fromId||'') === String(match.from||match.fromId||'');
        const sameTo = String(m.to||m.toId||'') === String(match.to||match.toId||'');
        const sameTs = Math.floor((Number(m.ts||m.createdAt||0))/1000) === Math.floor((Number(match.ts||match.createdAt||0))/1000);
        const sameText = String(m.text||m.body||m.message||'').slice(0,80) === String(match.text||match.body||match.message||'').slice(0,80);
        // keep the message if it is NOT the same as match
        return !(sameFrom && sameTo && sameTs && sameText);
      });
      if(filtered.length) obj[peer] = filtered; else delete obj[peer];
      localStorage.setItem(key, JSON.stringify(obj));
      console.info('Removed local message for', peer);
    }catch(e){ console.warn('Failed to remove local message', e); }
  }

  // Prune localStorage messages that are already present in server-provided conversations
  function pruneLocalStorageAgainstServer(){
    try{
      const key = localStorageKey();
      const raw = localStorage.getItem(key); if(!raw) return;
      const obj = JSON.parse(raw || '{}');
      let changed = false;
      Object.keys(obj).forEach(peer=>{
        const localMsgs = obj[peer] || [];
        if(!conversations[peer] || !conversations[peer].msgs) return;
        const serverMsgs = conversations[peer].msgs || [];
        const keep = localMsgs.filter(lm=>{
          // keep local message if not present on server
          const found = serverMsgs.find(sm=>{
            const sameFrom = String(sm.from||sm.fromId||'') === String(lm.from||lm.fromId||'');
            const sameTo = String(sm.to||sm.toId||'') === String(lm.to||lm.toId||'');
            const sameTs = Math.floor((Number(sm.ts||sm.createdAt||0))/1000) === Math.floor((Number(lm.ts||lm.createdAt||0))/1000);
            const sameText = String(sm.text||sm.body||sm.message||'').slice(0,80) === String(lm.text||lm.body||lm.message||'').slice(0,80);
            return sameFrom && sameTo && sameTs && sameText;
          });
          return !found;
        });
        if(keep.length !== localMsgs.length){ obj[peer] = keep; changed = true; }
        if(obj[peer] && obj[peer].length===0) delete obj[peer];
      });
      if(changed) { localStorage.setItem(key, JSON.stringify(obj)); console.info('Pruned localStorage entries against server history'); }
    }catch(e){ console.warn('Prune localStorage failed', e); }
  }

  function handleServerMessage(msg){
    if(msg.type==='presence'){
      // {userId, online}
      const userId = String(msg.userId || '');
      if(!userId) return;
      if(userId === String(currentUserChatId() || '')) return;
      // update teacher list if present
      const t = TEACHERS.find(x=>x.id===userId);
      if(t) t.online = !!msg.online;
      Object.values(conversations).forEach(c=>{ if(c.peerId===userId) c.online = msg.online });
      // reflect presence in CONTACTS as well
      if(!CONTACTS[userId]){
        CONTACTS[userId] = { id: userId, name: t?.name || userId, avatar: null, online: !!msg.online };
      } else {
        CONTACTS[userId].online = !!msg.online;
      }
      renderConversations(); renderMessages();
    }
    if(msg.type==='group_created'){
      const g = msg.group || {};
      if(g.id){
        const key = `${GROUP_PREFIX}${g.id}`;
        GROUPS[g.id] = { id: g.id, name: g.name, members: g.members || [] };
        CONTACTS[key] = { id: key, name: g.name, online: false, type: 'group', members: g.members || [] };
        renderConversations();
      }
      return;
    }
    if(msg.type==='group_members_added'){
      const gid = Number(msg.groupId || 0);
      const added = Array.isArray(msg.members) ? msg.members : [];
      const key = `${GROUP_PREFIX}${gid}`;
      if(!gid) return;
      if(!GROUPS[gid]){
        // group unknown yet; fetch details from server so we can join
        (async ()=>{
          try{
            const res = await apiFetch(`/api/messaging/groups/${gid}`, { cache:'no-store' });
            if(res.ok){
              const g = await res.json();
              GROUPS[gid] = { id: g.id, name: g.name, members: g.members || [] };
              CONTACTS[key] = { id: key, name: g.name, online: false, type: 'group', members: g.members || [] };
              renderConversations();
            }
          }catch(_e){ }
        })();
      } else {
        GROUPS[gid].members = Array.from(new Set([...(GROUPS[gid].members||[]), ...added]));
        if(CONTACTS[key]) CONTACTS[key].members = GROUPS[gid].members;
        if(currentPeer === key) renderMessages();
      }
      return;
    }
    if(msg.type==='message'){
      const mRaw = msg.message || msg;
      const from = String(mRaw.from || mRaw.fromId || mRaw.sender || mRaw.senderId || '');
      const to = String(mRaw.to || mRaw.toId || mRaw.recipient || mRaw.recipientId || '');
      const selfChatId = String(currentUserChatId() || '');
      const text = mRaw.text || mRaw.body || mRaw.message || '';
      const ts = mRaw.ts || mRaw.createdAt || Date.now();
      // determine conversation peer, groups always use the "to" field
      let peer;
      if(to.startsWith(GROUP_PREFIX)){
        peer = to;
      } else {
        peer = (from === selfChatId) ? to : from;
      }
      if(!peer || peer === selfChatId) return;
      restoreConversation(peer);
      // ensure the sender/peer exists in CONTACTS
      if(from && from !== selfChatId && !CONTACTS[from]){
        CONTACTS[from] = { id: from, name: mRaw.fromName || mRaw.senderName || from, avatar: null, online: false };
      }
      if(to && to !== selfChatId && !CONTACTS[to]){
        CONTACTS[to] = { id: to, name: mRaw.toName || mRaw.recipientName || to, avatar: null, online: false };
      }
      conversations[peer]=conversations[peer]||{peerId:peer,name:CONTACTS[peer]?.name||peer,msgs:[],lastTs:0,unread:0};
      const storedMsg = { from, to, text, ts };
      conversations[peer].msgs.push(storedMsg);
      // If this message originated from the current user and was saved locally, remove the local copy
      try{ if(String(from) === String(currentUserChatId())) removeLocalMessage(peer, storedMsg); }catch(e){/*ignore*/}
      // update last message preview, prefix with sender on group chats
      if(peer.startsWith(GROUP_PREFIX) && from !== selfChatId){
        const senderName = mRaw.fromName || '';
        conversations[peer].lastMessage = senderName ? `${senderName}: ${text}` : text;
      } else {
        conversations[peer].lastMessage = text;
      }
      conversations[peer].lastTs = ts;
      if(String(currentPeer)!==String(peer) && !isMuted(peer)){ conversations[peer].unread = (conversations[peer].unread||0)+1 }
      renderConversations(); renderMessages(); updateBadge();
    }
    if(msg.type==='init'){ // initial history & presence
      (msg.conversations||[]).forEach(c=>{
        if(!c || !c.peerId) return;
        if(isDeleted(c.peerId)){
          conversations[c.peerId] = Object.assign({ unread: 0, msgs: [], lastMessage: '', lastTs: 0 }, c, { msgs: [], lastMessage: '', lastTs: 0 });
        } else {
          conversations[c.peerId]=Object.assign({ unread: 0, msgs: [] }, c);
        }
        if(!CONTACTS[c.peerId]){
          CONTACTS[c.peerId] = { id: c.peerId, name: c.name || c.peerId, avatar: null, online: !!c.online };
        }
      });
      // merge local fallback so client doesn't lose sent messages that server didn't persist yet
      mergeLocalMessages();
      // prune any local messages that are duplicated by server-provided history
      try{ pruneLocalStorageAgainstServer(); }catch(e){/*ignore*/}
      renderConversations(); updateBadge();
    }
  }

  function sendMessage(text){
    if(!currentPeer) return;
    restoreConversation(currentPeer);
    const isGroup = String(currentPeer).startsWith(GROUP_PREFIX);
    const m = {
      type: isGroup ? 'group_message' : 'message',
      to: currentPeer,
      text,
      fromName: window.CURRENT_USER.name,
      fromId: currentUserChatId(),
      ts: Date.now()
    };
    if(isGroup){
      // include groupId for the server convenience
      m.groupId = Number(currentPeer.slice(GROUP_PREFIX.length));
    }
    // Best-effort persist: POST to common message endpoints so server can save to DB.
    (async ()=>{
      const payload = {from: currentUserChatId(), to: currentPeer, text: text, ts: m.ts};
      const postEndpoints = ['/api/messages','/api/chat/messages','/api/messaging/send','/api/chat/send'];
      for(const ep of postEndpoints){
        try{
          const r = await apiFetch(ep, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
          if(r.ok){ console.info('Message persisted to', ep); break; }
        }catch(e){ /* ignore and try next */ }
      }
    })();

    try{ ws && ws.readyState===WebSocket.OPEN && ws.send(JSON.stringify(m)); }catch(e){ console.warn('WS send failed, message will remain in local UI and retried by server sync', e); }
    // locally append and persist to localStorage immediately
    conversations[currentPeer]=conversations[currentPeer]||{peerId:currentPeer,msgs:[]};
    const localMsg = { from: String(currentUserChatId()), to: String(currentPeer), text, ts: m.ts };
    conversations[currentPeer].msgs.push(localMsg);
    conversations[currentPeer].lastMessage = text; conversations[currentPeer].lastTs = m.ts;
    try{ saveLocalMessages(); }catch(e){ console.warn('Failed to save local messages', e); }
    renderConversations(); renderMessages();
  }

  // UI wiring
  async function initializeMessagingUI(){
    if(window.__messagingUIInitialized) return;
    window.__messagingUIInitialized = true;

    document.addEventListener('click', (event)=>{
      const trigger = event.target?.closest?.('#chatBtn, .chat-btn, [data-open-chat="true"]');
      if(!trigger) return;
      togglePanelFromIcon();
    }, true);

    // new conversation/group button
    const newBtn = el('chatNewBtn');
    if(newBtn){
      newBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        showNewConversationDialog();
      });
    }

    const closeBtn = el('chatCloseBtn');
    if(closeBtn) closeBtn.addEventListener('click', ()=> setPanelOpen(false));

    const markAllReadBtn = el('chatMarkAllReadBtn');
    if(markAllReadBtn) markAllReadBtn.addEventListener('click', markAllConversationsRead);

    const pinBtn = el('chatPinBtn');
    if(pinBtn) pinBtn.addEventListener('click', ()=>{
      if(!currentPeer) return;
      setPinned(currentPeer, !isPinned(currentPeer));
    });

    const muteBtn = el('chatMuteBtn');
    if(muteBtn) muteBtn.addEventListener('click', ()=>{
      if(!currentPeer) return;
      setMuted(currentPeer, !isMuted(currentPeer));
    });

    const addMemberBtn = el('chatAddMemberBtn');
    if(addMemberBtn) addMemberBtn.addEventListener('click', ()=>{
      showAddMembersDialog();
    });

    const deleteBtn = el('chatDeleteBtn');
    if(deleteBtn) deleteBtn.addEventListener('click', ()=>{
      if(!currentPeer) return;
      requestDeleteConversation(currentPeer);
    });

    const searchInput = el('chatSearchInput');
    if(searchInput){
      searchInput.addEventListener('input', ()=>{
        currentSearch = searchInput.value || '';
        renderConversations();
      });
    }

    document.querySelectorAll('.chat-filter-btn').forEach(btnEl => {
      btnEl.addEventListener('click', ()=>{
        const next = btnEl.getAttribute('data-chat-filter') || 'all';
        currentFilter = next;
        document.querySelectorAll('.chat-filter-btn').forEach(x => x.classList.toggle('active', x === btnEl));
        renderConversations();
      });
    });

    document.addEventListener('keydown', (event)=>{
      if(event.key === 'Escape'){
        const panel = el('chatPanel');
        if(panel && panel.getAttribute('aria-hidden') === 'false') setPanelOpen(false);
      }
      if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm'){
        event.preventDefault();
        togglePanelFromIcon();
      }
    });

    // Back button to return to conversations list (mobile/compact view)
    const backBtn = el('chatBackBtn');
    if(backBtn) backBtn.addEventListener('click', closeConversation);
    el('chatSendBtn')?.addEventListener('click', ()=>{ 
      const input = el('chatMessageInput'); 
      if(!input) return; 
      const v = input.value.trim(); 
      if(!v) return; 
      sendMessage(v); 
      input.value='';
    });
    el('chatMessageInput')?.addEventListener('keydown', e=>{ 
      if(e.key==='Enter' && !e.shiftKey){ 
        e.preventDefault(); 
        el('chatSendBtn').click(); 
      } 
    });
    await resolveCurrentUser();
    await loadConversationPrefs();
    await loadContacts();
    await loadGroups();
    // Try to load persisted history (REST) before relying solely on WS init
    await fetchConversationHistory();
    renderConversations();
    refreshConversationActionButtons();
    setConnectionState('connecting', 'Connecting');
    ensureWs();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initializeMessagingUI);
  } else {
    initializeMessagingUI();
  }

  // expose for debugging
  window.Messaging = {
    openConversation,
    closeConversation,
    conversations,
    ensureWs,
    setPinned,
    setMuted,
    deleteConversation
  };

})();

