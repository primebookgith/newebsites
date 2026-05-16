// ============================================================
// PRIME BOOK ACCOUNTING — WEB CLIENT PORTAL v3
// Includes: Compliance, Documents, Chat with Prime Book Team
// ============================================================

var SUPABASE_URL = 'https://plcdgqwrwwitkmbsghkh.supabase.co';
var SUPABASE_KEY = 'sb_publishable_vGe6NG1vU4HLHjhPpm7LYQ_G-TXWMXf';
var WHATSAPP_NUMBER = '+971521859433';
var sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── HELPERS ─────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function formatDateGroup(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function statusColor(s) {
  if (!s) return '#999';
  if (s === 'FILED' || s === 'DONE') return '#2ecc71';
  if (s === 'PENDING') return '#f1c40f';
  if (s === 'OVERDUE') return '#e74c3c';
  if (s === 'N/A') return '#aaa';
  return '#999';
}
function openWhatsApp(type) {
  var message = type === 'reports'
    ? 'Hi Prime Book Accounting, I would like to request a copy of my latest Financial Reports.'
    : 'Hello Prime Book Accounting, I have a general inquiry about my Accounting or Tax Status.';
  window.open('https://wa.me/' + WHATSAPP_NUMBER.replace('+', '') + '?text=' + encodeURIComponent(message), '_blank');
}
function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── CONTACT FORM ─────────────────────────────────────────────
var contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var email = document.getElementById('email').value;
    var message = document.getElementById('message').value;
    var btn = contactForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Sending…';
    var result = await sb.from('leads').insert([{ email_address: email, message_content: message }]);
    if (result.error) { alert('Error: ' + result.error.message); btn.disabled = false; btn.textContent = 'Submit'; }
    else { alert('Message sent successfully!'); contactForm.reset(); btn.disabled = false; btn.textContent = 'Submit'; }
  });
}

// ─── SYNC USER ────────────────────────────────────────────────
async function syncUserToSupabase() {
  if (!window.Clerk || !window.Clerk.user) return;
  var user = window.Clerk.user;
  var email = user.primaryEmailAddress.emailAddress;
  var fullName = ((user.firstName || '') + ' ' + (user.lastName || '')).trim();
  try {
    await sb.from('leads').upsert({ email_address: email, full_name: fullName, last_seen: new Date().toISOString() }, { onConflict: 'email_address' });
  } catch(err) { console.error('Sync error:', err); }
}

// ─── STATE ───────────────────────────────────────────────────
var _clientEmail = '';
var _myDocs = [];
var _sharedDocs = [];
var _messages = [];
var _chatChannel = null;
var _chatPoll = null;
var _isSelectMode = false;
var _selectedFiles = [];

// ─── MAIN PORTAL LOADER ───────────────────────────────────────
async function loadPortal() {
  var user = window.Clerk && window.Clerk.user;
  var dashboard = document.getElementById('client-dashboard');
  if (!user || !dashboard) return;

  _clientEmail = user.primaryEmailAddress.emailAddress;
  var firstName = user.firstName || '';
  var lastName = user.lastName || '';
  var fullName = (firstName + ' ' + lastName).trim();
  var displayName = fullName || _clientEmail.split('@')[0];
  var initials = (firstName && lastName) ? (firstName[0] + lastName[0]).toUpperCase() : (displayName[0] || 'C').toUpperCase();

  dashboard.style.display = 'block';
  dashboard.innerHTML = buildPortalHTML(displayName, initials, _clientEmail);

  wirePortalEvents();
  await Promise.all([fetchCompliance(), fetchSharedDocs(), fetchMyDocs()]);
  initChat();
}

// ─── BUILD PORTAL HTML ────────────────────────────────────────
function buildPortalHTML(displayName, initials, email) {
  return `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600;700&display=swap');
    #client-dashboard * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
    #pb-topbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 24px; background: #fff;
      border-bottom: 1px solid #f0f0f0; position: sticky; top: 0; z-index: 100;
      box-shadow: 0 1px 6px rgba(0,0,0,0.04);
    }
    #pb-topbar .pb-brand-title { font-family: 'Cinzel', serif; font-size: 20px; color: #b89733; letter-spacing: 2px; display: block; }
    #pb-topbar .pb-brand-sub { font-size: 10px; color: #999; letter-spacing: 0.5px; }
    #pb-topbar .pb-topright { display: flex; align-items: center; gap: 14px; }
    #pb-avatar { width: 36px; height: 36px; border-radius: 50%; background: #1a2b48; display: flex; align-items: center; justify-content: center; font-family: 'Cinzel', serif; font-size: 14px; color: #b89733; font-weight: 700; }
    #pb-logout-btn { color: #e74c3c; font-size: 12px; font-weight: 600; background: none; border: none; cursor: pointer; padding: 0; }
    #pb-logout-btn:hover { text-decoration: underline; }
    #pb-body { max-width: 680px; margin: 0 auto; padding: 0 20px 60px; }
    #pb-hero { padding: 28px 0 16px; }
    #pb-hero .pb-welcome { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
    #pb-hero .pb-name { font-family: 'Cinzel', serif; font-size: 28px; color: #1a2b48; letter-spacing: 2px; line-height: 1.2; text-transform: uppercase; }
    #pb-hero .pb-divider { width: 42px; height: 3px; background: #b89733; border-radius: 2px; margin: 10px 0; }
    #pb-hero .pb-email { font-size: 12px; color: #aaa; }
    #pb-compliance { background: #1a2b48; border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(26,43,72,0.18); }
    .pb-comp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .pb-comp-title { color: #fff; font-size: 15px; font-weight: 700; }
    .pb-comp-live { color: #2ecc71; font-size: 10px; font-weight: 700; }
    .pb-comp-row { display: flex; justify-content: space-between; align-items: center; }
    .pb-comp-label { color: #fff; font-size: 13px; font-weight: 600; }
    .pb-comp-due { color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 2px; }
    .pb-comp-badge { border: 1px solid; border-radius: 8px; padding: 4px 10px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .pb-comp-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 14px 0; }
    .pb-comp-loading { color: #b89733; font-size: 13px; text-align: center; padding: 8px 0; }
    #pb-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .pb-action-btn { border: none; border-radius: 14px; padding: 20px 14px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: opacity 0.18s, transform 0.18s; }
    .pb-action-btn:hover { opacity: 0.88; transform: translateY(-1px); }
    .pb-action-btn .pb-action-icon { font-size: 28px; }
    .pb-action-btn .pb-action-text { font-size: 12px; font-weight: 700; color: #fff; text-align: center; }
    .pb-btn-upload { background: #132a50ee; }
    .pb-btn-reports { background: #b89733; }
    #pb-upload-progress { background: #f8f9fa; border: 1px solid #eee; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: none; font-size: 12px; color: #1a2b48; font-weight: 600; }
    #pb-upload-bar-wrap { background: #e0e0e0; border-radius: 4px; height: 5px; margin-top: 8px; overflow: hidden; }
    #pb-upload-bar { background: #b89733; height: 100%; width: 0; transition: width 0.3s; border-radius: 4px; }
    .pb-section { margin-bottom: 8px; }
    .pb-section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
    .pb-section-title { font-size: 15px; font-weight: 700; color: #1a2b48; }
    .pb-section-sub { font-size: 11px; color: #999; margin-bottom: 10px; }
    .pb-section-divider { height: 1px; background: #f0f0f0; margin: 18px 0; }
    .pb-select-controls { display: flex; align-items: center; gap: 14px; }
    .pb-select-btn { background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 700; color: #b89733; padding: 0; }
    .pb-delete-btn { background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 700; color: #e74c3c; padding: 0; }
    .pb-cancel-btn { display: block; text-align: center; color: #888; font-size: 13px; cursor: pointer; margin-top: 10px; background: none; border: none; width: 100%; }
    .pb-empty { background: #f8f9fa; border: 1px solid #eee; border-radius: 12px; padding: 28px 20px; text-align: center; margin-bottom: 10px; }
    .pb-empty-icon { font-size: 32px; margin-bottom: 8px; }
    .pb-empty-title { color: #aaa; font-size: 14px; font-weight: 600; }
    .pb-empty-sub { color: #ccc; font-size: 12px; margin-top: 4px; }
    .pb-doc-row { display: flex; align-items: center; background: #fff; padding: 14px; border-radius: 12px; margin-bottom: 8px; border: 1px solid #eee; transition: border-color 0.18s; cursor: pointer; }
    .pb-doc-row:hover { border-color: #b89733; }
    .pb-doc-row.selected { border-color: #b89733; background: #fffdf5; }
    .pb-doc-icon { font-size: 22px; margin-right: 12px; flex-shrink: 0; }
    .pb-doc-info { flex: 1; min-width: 0; }
    .pb-doc-name { font-size: 13px; font-weight: 600; color: #1a2b48; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pb-doc-date { font-size: 11px; color: #999; margin-top: 2px; }
    .pb-doc-actions { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
    .pb-view-btn { background: none; border: none; color: #1a2b48; font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; }
    .pb-view-btn:hover { text-decoration: underline; }
    .pb-del-btn { background: none; border: none; color: #e74c3c; font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; }
    .pb-del-btn:hover { text-decoration: underline; }

    /* ── CHAT STYLES ── */
    #pb-chat-section { margin-bottom: 8px; }
    #pb-chat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    #pb-chat-unread { background: #e74c3c; color: #fff; border-radius: 10px; min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; padding: 0 6px; }
    #pb-chat-window { height: 340px; background: #f8f9fa; border-radius: 14px; border: 1px solid #eee; margin-top: 10px; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 6px; scroll-behavior: smooth; }
    #pb-chat-window::-webkit-scrollbar { width: 4px; }
    #pb-chat-window::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }
    .pb-chat-date-sep { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
    .pb-chat-date-line { flex: 1; height: 1px; background: #e0e0e0; }
    .pb-chat-date-text { font-size: 11px; color: #aaa; font-weight: 600; white-space: nowrap; }
    .pb-chat-bubble-wrap { display: flex; max-width: 80%; }
    .pb-chat-bubble-wrap.from-client { align-self: flex-end; flex-direction: row-reverse; }
    .pb-chat-bubble-wrap.from-employee { align-self: flex-start; }
    .pb-chat-bubble { border-radius: 16px; padding: 10px 14px; }
    .pb-chat-bubble.client-bubble { background: #1a2b48; border-bottom-right-radius: 4px; }
    .pb-chat-bubble.employee-bubble { background: #b89733; border-bottom-left-radius: 4px; }
    .pb-chat-sender { font-size: 10px; color: rgba(255,255,255,0.8); font-weight: 700; margin-bottom: 3px; }
    .pb-chat-text { font-size: 14px; color: #fff; line-height: 1.45; word-break: break-word; }
    .pb-chat-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; }
    .pb-chat-time { font-size: 10px; color: rgba(255,255,255,0.6); }
    .pb-chat-tick { font-size: 11px; color: rgba(255,255,255,0.8); font-weight: 700; }
    .pb-chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #aaa; gap: 8px; }
    .pb-chat-empty-icon { font-size: 36px; }
    .pb-chat-empty-text { font-size: 14px; font-weight: 600; }
    .pb-chat-empty-sub { font-size: 12px; color: #ccc; }
    #pb-chat-templates { display: flex; gap: 8px; overflow-x: auto; padding: 8px 0 4px; scrollbar-width: none; }
    #pb-chat-templates::-webkit-scrollbar { display: none; }
    .pb-chat-chip { background: #f0f4ff; border: 1px solid #dce5ff; border-radius: 20px; padding: 5px 12px; font-size: 11px; color: #1a2b48; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: background 0.15s; }
    .pb-chat-chip:hover { background: #dce5ff; }
    #pb-chat-input-row { display: flex; align-items: flex-end; gap: 8px; margin-top: 4px; }
    #pb-chat-input { flex: 1; border: 1px solid #e0e0e0; border-radius: 22px; padding: 10px 16px; font-size: 14px; color: #1a2b48; background: #fff; resize: none; max-height: 100px; min-height: 44px; font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.15s; }
    #pb-chat-input:focus { border-color: #b89733; }
    #pb-chat-send { width: 44px; height: 44px; border-radius: 50%; background: #1a2b48; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #b89733; flex-shrink: 0; transition: opacity 0.15s; }
    #pb-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
    #pb-chat-send:not(:disabled):hover { opacity: 0.85; }

    #pb-support-btn { display: block; width: 100%; background: #25D366; border: none; border-radius: 12px; padding: 16px; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; margin: 24px 0 0; text-align: center; transition: opacity 0.18s; }
    #pb-support-btn:hover { opacity: 0.88; }
    #pb-privacy { background: #f8f9fa; border: 1px solid #eee; border-radius: 10px; padding: 12px; text-align: center; margin-top: 16px; font-size: 11px; color: #999; line-height: 1.5; }
    #pb-footer { text-align: center; margin-top: 24px; }
    #pb-footer .pb-footer-main { color: #1a2b48; font-size: 12px; font-weight: 700; }
    #pb-footer .pb-footer-sub { color: #c19e14; font-size: 11px; margin-top: 4px; }
  </style>

  <div id="pb-topbar">
    <div class="pb-brand">
      <span class="pb-brand-title">PRIME BOOK</span>
      <span class="pb-brand-sub">Client Portal</span>
    </div>
    <div class="pb-topright">
      <div id="pb-avatar">${initials}</div>
      <button id="pb-logout-btn">Secure Logout</button>
    </div>
  </div>

  <div id="pb-body">
    <div id="pb-hero">
      <div class="pb-welcome">Welcome Back,</div>
      <div class="pb-name">${displayName}</div>
      <div class="pb-divider"></div>
      <div class="pb-email">${email}</div>
    </div>

    <div id="pb-compliance">
      <div class="pb-comp-header">
        <span class="pb-comp-title">Compliance Status</span>
        <span class="pb-comp-live">● LIVE</span>
      </div>
      <div id="pb-compliance-body"><div class="pb-comp-loading">Loading status…</div></div>
    </div>

    <div id="pb-actions">
      <button class="pb-action-btn pb-btn-upload" id="pb-upload-btn">
        <span class="pb-action-icon">📁</span>
        <span class="pb-action-text" id="pb-upload-label">Upload Documents</span>
      </button>
      <button class="pb-action-btn pb-btn-reports" id="pb-reports-btn">
        <span class="pb-action-icon">📊</span>
        <span class="pb-action-text">Request Reports</span>
      </button>
    </div>

    <div id="pb-upload-progress">
      <span id="pb-upload-status">Uploading…</span>
      <div id="pb-upload-bar-wrap"><div id="pb-upload-bar"></div></div>
    </div>
    <input type="file" id="pb-file-input" multiple style="display:none">

    <!-- ── CHAT SECTION ── -->
    <div class="pb-section-divider"></div>
    <div id="pb-chat-section">
      <div id="pb-chat-header">
        <div>
          <div class="pb-section-title">Messages from Prime Book <span id="pb-chat-unread" style="display:none"></span></div>
          <div class="pb-section-sub">Chat directly with your accounting team</div>
        </div>
      </div>
      <div id="pb-chat-window">
        <div class="pb-chat-empty">
          <div class="pb-chat-empty-icon">💬</div>
          <div class="pb-chat-empty-text">No messages yet.</div>
          <div class="pb-chat-empty-sub">Your Prime Book team will message you here.</div>
        </div>
      </div>
      <div id="pb-chat-templates">
        <div class="pb-chat-chip" data-msg="Documents uploaded ✓">Documents uploaded ✓</div>
        <div class="pb-chat-chip" data-msg="Please review my submission.">Please review my submission.</div>
        <div class="pb-chat-chip" data-msg="When will my VAT filing be ready?">When will my VAT filing be ready?</div>
        <div class="pb-chat-chip" data-msg="I have a question about my account.">I have a question about my account.</div>
        <div class="pb-chat-chip" data-msg="Thank you for the update!">Thank you for the update!</div>
      </div>
      <div id="pb-chat-input-row">
        <textarea id="pb-chat-input" placeholder="Type a message…" rows="1" maxlength="500"></textarea>
        <button id="pb-chat-send" disabled>➤</button>
      </div>
    </div>

    <div class="pb-section-divider"></div>

    <div class="pb-section">
      <div class="pb-section-title">Documents from Prime Book</div>
      <div class="pb-section-sub">Sent by your Accounting Team • read only</div>
      <div id="pb-shared-list"><div class="pb-empty"><div class="pb-empty-icon">⏳</div><div class="pb-empty-title">Loading…</div></div></div>
    </div>

    <div class="pb-section-divider"></div>

    <div class="pb-section">
      <div class="pb-section-header">
        <div>
          <div class="pb-section-title">My Uploaded Submissions</div>
          <div class="pb-section-sub" id="pb-mydocs-count">Loading…</div>
        </div>
        <div id="pb-select-controls" class="pb-select-controls" style="display:none">
          <button class="pb-select-btn" id="pb-selectall-btn">Select All</button>
          <button class="pb-delete-btn" id="pb-bulkdelete-btn" style="display:none">Delete (0)</button>
        </div>
        <div id="pb-select-toggle" style="display:none">
          <button class="pb-select-btn" id="pb-enter-select-btn">Select</button>
        </div>
      </div>
      <div id="pb-my-list"><div class="pb-empty"><div class="pb-empty-icon">⏳</div><div class="pb-empty-title">Loading…</div></div></div>
    </div>

    <button id="pb-support-btn">💬&nbsp; Connect with Advisor</button>
    <div id="pb-privacy">🔒 Your portal is encrypted and secured. Data is never shared with third parties.</div>
    <div id="pb-footer">
      <div class="pb-footer-main">Prime Book Accounting &amp; Bookkeeping</div>
      <div class="pb-footer-sub">Dubai, UAE 🇦🇪 • ${new Date().getFullYear()}</div>
    </div>
  </div>`;
}

// ─── WIRE PORTAL EVENTS ───────────────────────────────────────
function wirePortalEvents() {
  document.getElementById('pb-logout-btn')?.addEventListener('click', async function() {
    if (confirm('Sign out of your Prime Book portal?')) {
      try { await window.Clerk.signOut(); } catch(e) { alert('Logout failed.'); }
    }
  });

  var uploadBtn = document.getElementById('pb-upload-btn');
  var fileInput = document.getElementById('pb-file-input');
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', function() { fileInput.click(); });
    fileInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files.length > 0) handleUpload(Array.from(e.target.files));
      fileInput.value = '';
    });
  }

  document.getElementById('pb-reports-btn')?.addEventListener('click', function() { openWhatsApp('reports'); });
  document.getElementById('pb-support-btn')?.addEventListener('click', function() { openWhatsApp('general'); });

  document.getElementById('pb-enter-select-btn')?.addEventListener('click', function() {
    _isSelectMode = true; _selectedFiles = []; renderMyDocs();
  });
  document.getElementById('pb-selectall-btn')?.addEventListener('click', function() {
    var all = _myDocs.map(function(d) { return d.name; });
    _selectedFiles = (_selectedFiles.length === all.length) ? [] : all.slice();
    renderMyDocs();
  });
  document.getElementById('pb-bulkdelete-btn')?.addEventListener('click', function() {
    if (!_selectedFiles.length) return;
    if (confirm('Remove ' + _selectedFiles.length + ' file(s)?')) bulkDelete();
  });

  // Chat events
  var chatInput = document.getElementById('pb-chat-input');
  var chatSend = document.getElementById('pb-chat-send');

  if (chatInput) {
    chatInput.addEventListener('input', function() {
      chatSend.disabled = !chatInput.value.trim();
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    });
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
  }
  if (chatSend) chatSend.addEventListener('click', sendChatMessage);

  document.querySelectorAll('.pb-chat-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      if (chatInput) { chatInput.value = chip.dataset.msg; chatSend.disabled = false; chatInput.focus(); }
    });
  });
}

// ─── CHAT: INIT ───────────────────────────────────────────────
async function initChat() {
  await fetchChatMessages();
  subscribeToChatMessages();
}

// ─── CHAT: FETCH ─────────────────────────────────────────────
async function fetchChatMessages() {
  var result = await sb
    .from('client_notes')
    .select('*')
    .eq('client_email', _clientEmail)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(100);

  if (result.error) { console.error('fetchChatMessages:', result.error); return; }
  _messages = result.data || [];

  // Mark employee messages as read
  var unread = _messages.filter(function(m) { return m.sender_type === 'employee' && !m.is_read; });
  if (unread.length > 0) {
    await sb.from('client_notes')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('client_email', _clientEmail)
      .eq('sender_type', 'employee')
      .eq('is_read', false);
  }

  renderChatMessages();
}

// ─── CHAT: SUBSCRIBE ─────────────────────────────────────────
function subscribeToChatMessages() {
  if (_chatChannel) { sb.removeChannel(_chatChannel); }
  if (_chatPoll) { clearInterval(_chatPoll); }

  _chatChannel = sb
    .channel('web-client-chat:' + _clientEmail.replace(/[@.]/g, '_') + ':' + Date.now())
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'client_notes',
      filter: 'client_email=eq.' + _clientEmail
    }, function(payload) {
      console.log('Chat realtime:', payload.eventType);
      if (payload.eventType === 'INSERT') {
        if (payload.new.deleted_at) return;
        var exists = _messages.find(function(m) { return m.id === payload.new.id; });
        if (!exists) {
          _messages.push(payload.new);
          if (payload.new.sender_type === 'employee') {
            sb.from('client_notes').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', payload.new.id);
          }
          renderChatMessages();
        }
      } else if (payload.eventType === 'UPDATE') {
        _messages = _messages.map(function(m) { return m.id === payload.new.id ? payload.new : m; });
        renderChatMessages();
      } else if (payload.eventType === 'DELETE') {
        _messages = _messages.filter(function(m) { return m.id !== payload.old.id; });
        renderChatMessages();
      }
    })
    .subscribe(function(status) { console.log('Chat channel:', status); });

  // Fallback polling every 8s
  _chatPoll = setInterval(fetchChatMessages, 8000);
}

// ─── CHAT: RENDER ─────────────────────────────────────────────
function renderChatMessages() {
  var window_el = document.getElementById('pb-chat-window');
  var unreadBadge = document.getElementById('pb-chat-unread');
  if (!window_el) return;

  var visible = _messages.filter(function(m) { return !m.deleted_at; });
  var unreadCount = visible.filter(function(m) { return m.sender_type === 'employee' && !m.is_read; }).length;

  if (unreadBadge) {
    if (unreadCount > 0) { unreadBadge.style.display = 'inline-flex'; unreadBadge.textContent = unreadCount; }
    else { unreadBadge.style.display = 'none'; }
  }

  if (visible.length === 0) {
    window_el.innerHTML = '<div class="pb-chat-empty"><div class="pb-chat-empty-icon">💬</div><div class="pb-chat-empty-text">No messages yet.</div><div class="pb-chat-empty-sub">Your Prime Book team will message you here.</div></div>';
    return;
  }

  var html = '';
  var lastDate = null;

  visible.forEach(function(msg) {
    var dateGroup = formatDateGroup(msg.created_at);
    if (dateGroup !== lastDate) {
      html += '<div class="pb-chat-date-sep"><div class="pb-chat-date-line"></div><span class="pb-chat-date-text">' + escHtml(dateGroup) + '</span><div class="pb-chat-date-line"></div></div>';
      lastDate = dateGroup;
    }
    var isClient = msg.sender_type === 'client';
    var bubbleClass = isClient ? 'client-bubble' : 'employee-bubble';
    var wrapClass = isClient ? 'from-client' : 'from-employee';
    html += '<div class="pb-chat-bubble-wrap ' + wrapClass + '">';
    html += '<div class="pb-chat-bubble ' + bubbleClass + '">';
    if (!isClient) html += '<div class="pb-chat-sender">Prime Book</div>';
    html += '<div class="pb-chat-text">' + escHtml(msg.message) + '</div>';
    html += '<div class="pb-chat-meta"><span class="pb-chat-time">' + formatTime(msg.created_at) + '</span>';
    if (isClient) html += '<span class="pb-chat-tick">' + (msg.is_read ? ' ✓✓' : ' ✓') + '</span>';
    html += '</div></div></div>';
  });

  window_el.innerHTML = html;
  window_el.scrollTop = window_el.scrollHeight;
}

// ─── CHAT: SEND ───────────────────────────────────────────────
async function sendChatMessage() {
  var chatInput = document.getElementById('pb-chat-input');
  var chatSend = document.getElementById('pb-chat-send');
  if (!chatInput || !chatInput.value.trim()) return;

  var msgText = chatInput.value.trim();
  chatInput.value = '';
  chatInput.style.height = 'auto';
  chatSend.disabled = true;

  var result = await sb.from('client_notes').insert({
    client_email: _clientEmail,
    author_email: _clientEmail,
    message: msgText,
    sender_type: 'client',
    is_read: false,
    created_at: new Date().toISOString()
  });

  if (result.error) {
    alert('Could not send message. Please try again.');
    chatInput.value = msgText;
    chatSend.disabled = false;
  }
}

// ─── COMPLIANCE ───────────────────────────────────────────────
async function fetchCompliance() {
  var body = document.getElementById('pb-compliance-body');
  if (!body) return;
  var result = await sb.from('client_compliance').select('*').eq('client_email', _clientEmail).single();
  var c = result.data || { vat_status: 'PENDING', vat_due: '—', ct_status: 'PENDING', ct_due: '—' };
  body.innerHTML = `
    <div class="pb-comp-row">
      <div><div class="pb-comp-label">VAT Returns Filing</div><div class="pb-comp-due">Due: ${escHtml(c.vat_due || '—')}</div></div>
      <div class="pb-comp-badge" style="border-color:${statusColor(c.vat_status)};color:${statusColor(c.vat_status)}">● ${escHtml(c.vat_status)}</div>
    </div>
    <div class="pb-comp-divider"></div>
    <div class="pb-comp-row">
      <div><div class="pb-comp-label">Corporate Tax Filing</div><div class="pb-comp-due">Due: ${escHtml(c.ct_due || '—')}</div></div>
      <div class="pb-comp-badge" style="border-color:${statusColor(c.ct_status)};color:${statusColor(c.ct_status)}">● ${escHtml(c.ct_status)}</div>
    </div>`;
}

// ─── SHARED DOCS ──────────────────────────────────────────────
async function fetchSharedDocs() {
  var container = document.getElementById('pb-shared-list');
  if (!container) return;
  var result = await sb.storage.from('client-documents').list('shared/' + _clientEmail + '/', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  var docs = (result.data || []).filter(function(d) { return d.metadata && d.metadata.size > 0; });
  _sharedDocs = docs;
  if (docs.length === 0) {
    container.innerHTML = '<div class="pb-empty"><div class="pb-empty-icon">📭</div><div class="pb-empty-title">No documents yet.</div><div class="pb-empty-sub">Your team will upload statements, reports and filings here.</div></div>';
    return;
  }
  container.innerHTML = docs.map(function(doc) {
    return '<div class="pb-doc-row" data-name="' + escHtml(doc.name) + '" data-folder="shared"><span class="pb-doc-icon">📤</span><div class="pb-doc-info"><div class="pb-doc-name">' + escHtml(doc.name) + '</div><div class="pb-doc-date">' + formatDate(doc.created_at) + ' • ' + formatBytes(doc.metadata && doc.metadata.size) + '</div></div><div class="pb-doc-actions"><button class="pb-view-btn">SHOW</button></div></div>';
  }).join('');
  container.querySelectorAll('.pb-doc-row').forEach(function(row) {
    row.querySelector('.pb-view-btn').addEventListener('click', function(e) { e.stopPropagation(); viewDocument(row.dataset.name, 'shared'); });
    row.addEventListener('click', function() { viewDocument(row.dataset.name, 'shared'); });
  });
}

// ─── MY DOCS ──────────────────────────────────────────────────
async function fetchMyDocs() {
  var result = await sb.storage.from('client-documents').list('uploads/' + _clientEmail + '/', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  _myDocs = (result.data || []).filter(function(d) { return d.metadata && d.metadata.size > 0; });
  renderMyDocs();
}

function renderMyDocs() {
  var container = document.getElementById('pb-my-list');
  var countEl = document.getElementById('pb-mydocs-count');
  var selectToggle = document.getElementById('pb-select-toggle');
  var selectControls = document.getElementById('pb-select-controls');
  var bulkDelBtn = document.getElementById('pb-bulkdelete-btn');
  var selectAllBtn = document.getElementById('pb-selectall-btn');
  if (!container) return;
  if (countEl) countEl.textContent = _myDocs.length + ' file' + (_myDocs.length !== 1 ? 's' : '') + ' uploaded';
  if (selectToggle) selectToggle.style.display = (!_isSelectMode && _myDocs.length > 0) ? '' : 'none';
  if (selectControls) selectControls.style.display = _isSelectMode ? '' : 'none';
  if (selectAllBtn) selectAllBtn.textContent = (_selectedFiles.length === _myDocs.length && _myDocs.length > 0) ? 'Unselect All' : 'Select All';
  if (bulkDelBtn) { bulkDelBtn.style.display = (_isSelectMode && _selectedFiles.length > 0) ? '' : 'none'; bulkDelBtn.textContent = 'Delete (' + _selectedFiles.length + ')'; }
  if (_myDocs.length === 0) {
    container.innerHTML = '<div class="pb-empty"><div class="pb-empty-icon">📂</div><div class="pb-empty-title">No documents uploaded yet.</div><div class="pb-empty-sub">Tap "Upload Documents" above to send files to your Prime Book team.</div></div>';
    return;
  }
  var html = _myDocs.map(function(doc) {
    var isSelected = _selectedFiles.indexOf(doc.name) !== -1;
    return '<div class="pb-doc-row' + (isSelected ? ' selected' : '') + '" data-name="' + escHtml(doc.name) + '"><span class="pb-doc-icon">' + (_isSelectMode ? (isSelected ? '✅' : '⭕') : '📄') + '</span><div class="pb-doc-info"><div class="pb-doc-name">' + escHtml(doc.name) + '</div><div class="pb-doc-date">' + formatDate(doc.created_at) + ' • ' + formatBytes(doc.metadata && doc.metadata.size) + '</div></div>' + (!_isSelectMode ? '<div class="pb-doc-actions"><button class="pb-view-btn" data-action="view">VIEW</button><button class="pb-del-btn" data-action="del">DEL</button></div>' : '') + '</div>';
  }).join('');
  if (_isSelectMode) html += '<button class="pb-cancel-btn" id="pb-cancel-select">Cancel Selection</button>';
  container.innerHTML = html;
  container.querySelectorAll('.pb-doc-row').forEach(function(row) {
    var name = row.dataset.name;
    if (_isSelectMode) {
      row.addEventListener('click', function() {
        var idx = _selectedFiles.indexOf(name);
        if (idx === -1) _selectedFiles.push(name); else _selectedFiles.splice(idx, 1);
        renderMyDocs();
      });
    } else {
      var viewBtn = row.querySelector('[data-action="view"]');
      var delBtn = row.querySelector('[data-action="del"]');
      if (viewBtn) viewBtn.addEventListener('click', function(e) { e.stopPropagation(); viewDocument(name, 'uploads'); });
      if (delBtn) delBtn.addEventListener('click', function(e) { e.stopPropagation(); deleteDocument(name); });
      row.addEventListener('click', function() { viewDocument(name, 'uploads'); });
    }
  });
  var cancelBtn = document.getElementById('pb-cancel-select');
  if (cancelBtn) cancelBtn.addEventListener('click', function() { _isSelectMode = false; _selectedFiles = []; renderMyDocs(); });
}

async function viewDocument(fileName, folder) {
  var result = await sb.storage.from('client-documents').createSignedUrl(folder + '/' + _clientEmail + '/' + fileName, 300);
  if (result.error) { alert('Could not open document. Please try again.'); return; }
  window.open(result.data.signedUrl, '_blank');
}
async function deleteDocument(fileName) {
  if (!confirm('Remove "' + fileName + '"?')) return;
  var result = await sb.storage.from('client-documents').remove(['uploads/' + _clientEmail + '/' + fileName]);
  if (result.error) alert('Delete failed.'); else await fetchMyDocs();
}
async function bulkDelete() {
  var paths = _selectedFiles.map(function(n) { return 'uploads/' + _clientEmail + '/' + n; });
  var result = await sb.storage.from('client-documents').remove(paths);
  if (result.error) alert('Could not complete bulk delete.');
  else { _selectedFiles = []; _isSelectMode = false; await fetchMyDocs(); }
}

async function handleUpload(files) {
  var progressEl = document.getElementById('pb-upload-progress');
  var statusEl = document.getElementById('pb-upload-status');
  var barEl = document.getElementById('pb-upload-bar');
  var labelEl = document.getElementById('pb-upload-label');
  var uploadBtn = document.getElementById('pb-upload-btn');
  if (uploadBtn) uploadBtn.disabled = true;
  if (labelEl) labelEl.textContent = 'Uploading…';
  if (progressEl) progressEl.style.display = 'block';
  var ok = 0, fail = 0;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (statusEl) statusEl.textContent = 'Uploading ' + (i + 1) + ' of ' + files.length + ': ' + file.name;
    if (barEl) barEl.style.width = Math.round((i / files.length) * 100) + '%';
    try {
      var clean = file.name.replace(/\s+/g, '_');
      var parts = clean.split('.');
      var ext = parts.length > 1 ? parts.pop() : '';
      var base = ext ? parts.join('.') : clean;
      var path = 'uploads/' + _clientEmail + '/' + base + '_' + Date.now() + (ext ? '.' + ext : '');
      var arrayBuffer = await file.arrayBuffer();
      var result = await sb.storage.from('client-documents').upload(path, arrayBuffer, { contentType: file.type || 'application/octet-stream', upsert: true });
      if (result.error) throw result.error;
      ok++;
    } catch(e) { fail++; }
  }
  if (barEl) barEl.style.width = '100%';
  if (statusEl) statusEl.textContent = ok + ' file(s) uploaded' + (fail ? ', ' + fail + ' failed' : '') + '.';
  setTimeout(function() { if (progressEl) progressEl.style.display = 'none'; if (barEl) barEl.style.width = '0'; }, 2500);
  if (labelEl) labelEl.textContent = 'Upload Documents';
  if (uploadBtn) uploadBtn.disabled = false;
  await fetchMyDocs();
}

window.addEventListener('load', function() {
  var checkClerk = setInterval(function() {
    if (window.Clerk && window.Clerk.user) {
      clearInterval(checkClerk);
      syncUserToSupabase();
      loadPortal();
    }
  }, 500);
  setTimeout(function() { clearInterval(checkClerk); }, 10000);
});
