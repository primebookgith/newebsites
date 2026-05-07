// ============================================================
// PRIME BOOK ACCOUNTING — WEB CLIENT PORTAL
// Aligned with React Native Client App (v2)
// ============================================================

// ─── CONSTANTS ───────────────────────────────────────────────
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
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
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

// ─── CONTACT FORM ─────────────────────────────────────────────
var contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var email = document.getElementById('email').value;
    var message = document.getElementById('message').value;
    var btn = contactForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    var result = await sb.from('leads').insert([{
      email_address: email,
      message_content: message
    }]);

    if (result.error) {
      alert('Error: ' + result.error.message);
      btn.disabled = false;
      btn.textContent = 'Submit';
    } else {
      alert('Message sent successfully!');
      contactForm.reset();
      btn.disabled = false;
      btn.textContent = 'Submit';
    }
  });
}

// ─── SYNC USER TO SUPABASE ────────────────────────────────────
async function syncUserToSupabase() {
  if (!window.Clerk || !window.Clerk.user) return;
  var user = window.Clerk.user;
  var email = user.primaryEmailAddress.emailAddress;
  var fullName = ((user.firstName || '') + ' ' + (user.lastName || '')).trim();

  try {
    // Check if client already exists
    var { data: existing } = await sb
      .from('leads')
      .select('id')
      .eq('email_address', email)
      .single();

    if (!existing) {
      // New client — INSERT to trigger SQL function
      await sb.from('leads').insert({
        email_address: email,
        full_name: fullName,
        last_seen: new Date().toISOString()
      });
    } else {
      // Existing — just update last seen
      await sb.from('leads').update({
        full_name: fullName,
        last_seen: new Date().toISOString()
      }).eq('email_address', email);
    }
  } catch (err) {
    console.error('Sync error:', err);
  }
}

// ─── STATE ───────────────────────────────────────────────────
var _clientEmail = '';
var _myDocs = [];
var _sharedDocs = [];
var _compliance = null;
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
  var initials = (firstName && lastName)
    ? (firstName[0] + lastName[0]).toUpperCase()
    : (displayName[0] || 'C').toUpperCase();

  // Inject portal HTML
  dashboard.style.display = 'block';
  dashboard.innerHTML = buildPortalHTML(displayName, initials, _clientEmail);

  // Wire up events
  wirePortalEvents();

  // Load data
  await Promise.all([fetchCompliance(), fetchSharedDocs(), fetchMyDocs()]);
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
    #pb-topbar .pb-brand { line-height: 1; }
    #pb-topbar .pb-brand-title {
      font-family: 'Cinzel', serif; font-size: 20px;
      color: #b89733; letter-spacing: 2px; display: block;
    }
    #pb-topbar .pb-brand-sub { font-size: 10px; color: #999; letter-spacing: 0.5px; }
    #pb-topbar .pb-topright { display: flex; align-items: center; gap: 14px; }
    #pb-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: #1a2b48; display: flex; align-items: center; justify-content: center;
      font-family: 'Cinzel', serif; font-size: 14px; color: #b89733; font-weight: 700;
      cursor: default;
    }
    #pb-logout-btn {
      color: #e74c3c; font-size: 12px; font-weight: 600;
      background: none; border: none; cursor: pointer; padding: 0;
    }
    #pb-logout-btn:hover { text-decoration: underline; }

    #pb-body { max-width: 680px; margin: 0 auto; padding: 0 20px 60px; }

    /* Hero */
    #pb-hero { padding: 28px 0 16px; }
    #pb-hero .pb-welcome { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
    #pb-hero .pb-name {
      font-family: 'Cinzel', serif; font-size: 28px;
      color: #1a2b48; letter-spacing: 2px; line-height: 1.2;
      text-transform: uppercase;
    }
    #pb-hero .pb-divider { width: 42px; height: 3px; background: #b89733; border-radius: 2px; margin: 10px 0; }
    #pb-hero .pb-email { font-size: 12px; color: #aaa; }

    /* Compliance */
    #pb-compliance {
      background: #1a2b48; border-radius: 16px; padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 4px 16px rgba(26,43,72,0.18);
    }
    .pb-comp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .pb-comp-title { color: #fff; font-size: 15px; font-weight: 700; }
    .pb-comp-live { color: #2ecc71; font-size: 10px; font-weight: 700; }
    .pb-comp-row { display: flex; justify-content: space-between; align-items: center; }
    .pb-comp-label { color: #fff; font-size: 13px; font-weight: 600; }
    .pb-comp-due { color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 2px; }
    .pb-comp-badge {
      border: 1px solid; border-radius: 8px;
      padding: 4px 10px; font-size: 12px; font-weight: 700; white-space: nowrap;
    }
    .pb-comp-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 14px 0; }
    .pb-comp-loading { color: #b89733; font-size: 13px; text-align: center; padding: 8px 0; }

    /* Action Grid */
    #pb-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .pb-action-btn {
      border: none; border-radius: 14px; padding: 20px 14px; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      transition: opacity 0.18s, transform 0.18s;
    }
    .pb-action-btn:hover { opacity: 0.88; transform: translateY(-1px); }
    .pb-action-btn:active { transform: scale(0.97); }
    .pb-action-btn .pb-action-icon { font-size: 28px; }
    .pb-action-btn .pb-action-text { font-size: 12px; font-weight: 700; color: #fff; text-align: center; }
    .pb-btn-upload { background: #132a50ee; }
    .pb-btn-reports { background: #b89733; }

    /* Upload progress */
    #pb-upload-progress {
      background: #f8f9fa; border: 1px solid #eee; border-radius: 10px;
      padding: 12px 16px; margin-bottom: 16px; display: none;
      font-size: 12px; color: #1a2b48; font-weight: 600;
    }
    #pb-upload-bar-wrap {
      background: #e0e0e0; border-radius: 4px; height: 5px; margin-top: 8px; overflow: hidden;
    }
    #pb-upload-bar { background: #b89733; height: 100%; width: 0; transition: width 0.3s; border-radius: 4px; }

    /* Sections */
    .pb-section { margin-bottom: 8px; }
    .pb-section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
    .pb-section-title { font-size: 15px; font-weight: 700; color: #1a2b48; }
    .pb-section-sub { font-size: 11px; color: #999; margin-bottom: 10px; }
    .pb-section-divider { height: 1px; background: #f0f0f0; margin: 18px 0; }

    /* Bulk select controls */
    .pb-select-controls { display: flex; align-items: center; gap: 14px; }
    .pb-select-btn { background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 700; color: #b89733; padding: 0; }
    .pb-delete-btn { background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 700; color: #e74c3c; padding: 0; }
    .pb-cancel-btn { display: block; text-align: center; color: #888; font-size: 13px; cursor: pointer; margin-top: 10px; background: none; border: none; width: 100%; }

    /* Empty state */
    .pb-empty {
      background: #f8f9fa; border: 1px solid #eee; border-radius: 12px;
      padding: 28px 20px; text-align: center; margin-bottom: 10px;
    }
    .pb-empty-icon { font-size: 32px; margin-bottom: 8px; }
    .pb-empty-title { color: #aaa; font-size: 14px; font-weight: 600; }
    .pb-empty-sub { color: #ccc; font-size: 12px; margin-top: 4px; }

    /* Doc rows */
    .pb-doc-row {
      display: flex; align-items: center; background: #fff;
      padding: 14px; border-radius: 12px; margin-bottom: 8px;
      border: 1px solid #eee; transition: border-color 0.18s;
      cursor: pointer;
    }
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

    /* Support */
    #pb-support-btn {
      display: block; width: 100%; background: #25D366;
      border: none; border-radius: 12px; padding: 16px;
      color: #fff; font-size: 16px; font-weight: 700;
      cursor: pointer; margin: 24px 0 0; text-align: center;
      transition: opacity 0.18s;
    }
    #pb-support-btn:hover { opacity: 0.88; }

    /* Privacy bar */
    #pb-privacy {
      background: #f8f9fa; border: 1px solid #eee; border-radius: 10px;
      padding: 12px; text-align: center; margin-top: 16px;
      font-size: 11px; color: #999; line-height: 1.5;
    }

    /* Footer */
    #pb-footer { text-align: center; margin-top: 24px; }
    #pb-footer .pb-footer-main { color: #1a2b48; font-size: 12px; font-weight: 700; }
    #pb-footer .pb-footer-sub { color: #c19e14; font-size: 11px; margin-top: 4px; }
  </style>

  <!-- Top Bar -->
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

    <!-- Hero -->
    <div id="pb-hero">
      <div class="pb-welcome">Welcome Back,</div>
      <div class="pb-name">${displayName}</div>
      <div class="pb-divider"></div>
      <div class="pb-email">${email}</div>
    </div>

    <!-- Compliance -->
    <div id="pb-compliance">
      <div class="pb-comp-header">
        <span class="pb-comp-title">Compliance Status</span>
        <span class="pb-comp-live">● LIVE</span>
      </div>
      <div id="pb-compliance-body">
        <div class="pb-comp-loading">Loading status…</div>
      </div>
    </div>

    <!-- Actions -->
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

    <!-- Upload progress -->
    <div id="pb-upload-progress">
      <span id="pb-upload-status">Uploading…</span>
      <div id="pb-upload-bar-wrap"><div id="pb-upload-bar"></div></div>
    </div>

    <!-- Hidden file input -->
    <input type="file" id="pb-file-input" multiple style="display:none">

    <!-- Shared Docs -->
    <div class="pb-section">
      <div class="pb-section-title">Documents from Prime Book</div>
      <div class="pb-section-sub">Sent by your Accounting Team • read only</div>
      <div id="pb-shared-list"><div class="pb-empty"><div class="pb-empty-icon">⏳</div><div class="pb-empty-title">Loading…</div></div></div>
    </div>

    <div class="pb-section-divider"></div>

    <!-- My Docs -->
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

    <!-- Connect Advisor -->
    <button id="pb-support-btn">💬&nbsp; Connect with Advisor</button>

    <!-- Privacy -->
    <div id="pb-privacy">🔒 Your portal is encrypted and secured. Data is never shared with third parties.</div>

    <!-- Footer -->
    <div id="pb-footer">
      <div class="pb-footer-main">Prime Book Accounting &amp; Bookkeeping</div>
      <div class="pb-footer-sub">Dubai, UAE 🇦🇪 • ${new Date().getFullYear()}</div>
    </div>

  </div>
  `;
}

// ─── WIRE PORTAL EVENTS ───────────────────────────────────────
function wirePortalEvents() {
  // Logout
  var logoutBtn = document.getElementById('pb-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
      if (confirm('Are you sure you want to sign out of your Prime Book portal?')) {
        try {
          await window.Clerk.signOut();
        } catch(e) {
          alert('Logout failed. Please try again.');
        }
      }
    });
  }

  // Upload
  var uploadBtn = document.getElementById('pb-upload-btn');
  var fileInput = document.getElementById('pb-file-input');
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', function() { fileInput.click(); });
    fileInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files.length > 0) {
        handleUpload(Array.from(e.target.files));
      }
      fileInput.value = '';
    });
  }

  // Reports
  var reportsBtn = document.getElementById('pb-reports-btn');
  if (reportsBtn) reportsBtn.addEventListener('click', function() { openWhatsApp('reports'); });

  // Advisor
  var supportBtn = document.getElementById('pb-support-btn');
  if (supportBtn) supportBtn.addEventListener('click', function() { openWhatsApp('general'); });

  // Enter select mode
  var enterSelectBtn = document.getElementById('pb-enter-select-btn');
  if (enterSelectBtn) {
    enterSelectBtn.addEventListener('click', function() {
      _isSelectMode = true;
      _selectedFiles = [];
      renderMyDocs();
    });
  }

  // Select all
  var selectAllBtn = document.getElementById('pb-selectall-btn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function() {
      var all = _myDocs.map(function(d) { return d.name; });
      _selectedFiles = (_selectedFiles.length === all.length) ? [] : all.slice();
      renderMyDocs();
    });
  }

  // Bulk delete
  var bulkDelBtn = document.getElementById('pb-bulkdelete-btn');
  if (bulkDelBtn) {
    bulkDelBtn.addEventListener('click', function() {
      if (!_selectedFiles.length) return;
      if (confirm('Remove ' + _selectedFiles.length + ' file(s)?')) {
        bulkDelete();
      }
    });
  }
}

// ─── FETCH COMPLIANCE ─────────────────────────────────────────
async function fetchCompliance() {
  var body = document.getElementById('pb-compliance-body');
  if (!body) return;

  var result = await sb
    .from('client_compliance')
    .select('*')
    .eq('client_email', _clientEmail)
    .single();

  var c = result.data || {
    vat_status: 'PENDING',
    vat_due: 'May 28, 2026',
    ct_status: 'PENDING',
    ct_due: 'September 30, 2026'
  };

  _compliance = c;

  body.innerHTML = `
    <div class="pb-comp-row">
      <div>
        <div class="pb-comp-label">VAT Returns Filing</div>
        <div class="pb-comp-due">Due: ${c.vat_due}</div>
      </div>
      <div class="pb-comp-badge" style="border-color:${statusColor(c.vat_status)};color:${statusColor(c.vat_status)}">
        ● ${c.vat_status}
      </div>
    </div>
    <div class="pb-comp-divider"></div>
    <div class="pb-comp-row">
      <div>
        <div class="pb-comp-label">Corporate Tax Filing</div>
        <div class="pb-comp-due">Due: ${c.ct_due}</div>
      </div>
      <div class="pb-comp-badge" style="border-color:${statusColor(c.ct_status)};color:${statusColor(c.ct_status)}">
        ● ${c.ct_status}
      </div>
    </div>
  `;
}

// ─── FETCH SHARED DOCS ────────────────────────────────────────
async function fetchSharedDocs() {
  var container = document.getElementById('pb-shared-list');
  if (!container) return;

  var result = await sb.storage
    .from('client-documents')
    .list('shared/' + _clientEmail + '/', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  var docs = (result.data || []).filter(function(d) {
    return d.metadata && d.metadata.size > 0;
  });
  _sharedDocs = docs;

  if (docs.length === 0) {
    container.innerHTML = `
      <div class="pb-empty">
        <div class="pb-empty-icon">📭</div>
        <div class="pb-empty-title">No documents yet.</div>
        <div class="pb-empty-sub">Your team will upload statements, reports and filings here.</div>
      </div>`;
    return;
  }

  container.innerHTML = docs.map(function(doc) {
    return `
      <div class="pb-doc-row" data-name="${escHtml(doc.name)}" data-folder="shared">
        <span class="pb-doc-icon">📤</span>
        <div class="pb-doc-info">
          <div class="pb-doc-name">${escHtml(doc.name)}</div>
          <div class="pb-doc-date">${formatDate(doc.created_at)} • ${formatBytes(doc.metadata && doc.metadata.size)}</div>
        </div>
        <div class="pb-doc-actions">
          <button class="pb-view-btn">SHOW</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.pb-doc-row').forEach(function(row) {
    row.querySelector('.pb-view-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      viewDocument(row.dataset.name, 'shared');
    });
    row.addEventListener('click', function() {
      viewDocument(row.dataset.name, 'shared');
    });
  });
}

// ─── FETCH MY DOCS ────────────────────────────────────────────
async function fetchMyDocs() {
  var result = await sb.storage
    .from('client-documents')
    .list('uploads/' + _clientEmail + '/', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  _myDocs = (result.data || []).filter(function(d) {
    return d.metadata && d.metadata.size > 0;
  });
  renderMyDocs();
}

// ─── RENDER MY DOCS ───────────────────────────────────────────
function renderMyDocs() {
  var container = document.getElementById('pb-my-list');
  var countEl = document.getElementById('pb-mydocs-count');
  var selectToggle = document.getElementById('pb-select-toggle');
  var selectControls = document.getElementById('pb-select-controls');
  var bulkDelBtn = document.getElementById('pb-bulkdelete-btn');
  var selectAllBtn = document.getElementById('pb-selectall-btn');

  if (!container) return;

  if (countEl) {
    countEl.textContent = _myDocs.length + ' file' + (_myDocs.length !== 1 ? 's' : '') + ' uploaded';
  }

  if (selectToggle) selectToggle.style.display = (!_isSelectMode && _myDocs.length > 0) ? '' : 'none';
  if (selectControls) selectControls.style.display = _isSelectMode ? '' : 'none';

  if (selectAllBtn) {
    selectAllBtn.textContent = (_selectedFiles.length === _myDocs.length && _myDocs.length > 0) ? 'Unselect All' : 'Select All';
  }
  if (bulkDelBtn) {
    bulkDelBtn.style.display = (_isSelectMode && _selectedFiles.length > 0) ? '' : 'none';
    bulkDelBtn.textContent = 'Delete (' + _selectedFiles.length + ')';
  }

  if (_myDocs.length === 0) {
    container.innerHTML = `
      <div class="pb-empty">
        <div class="pb-empty-icon">📂</div>
        <div class="pb-empty-title">No documents uploaded yet.</div>
        <div class="pb-empty-sub">Tap "Upload Documents" above to send files to your Prime Book team.</div>
      </div>`;
    return;
  }

  var html = _myDocs.map(function(doc) {
    var isSelected = _selectedFiles.indexOf(doc.name) !== -1;
    return `
      <div class="pb-doc-row${isSelected ? ' selected' : ''}" data-name="${escHtml(doc.name)}">
        <span class="pb-doc-icon">${_isSelectMode ? (isSelected ? '✅' : '⭕') : '📄'}</span>
        <div class="pb-doc-info">
          <div class="pb-doc-name">${escHtml(doc.name)}</div>
          <div class="pb-doc-date">${formatDate(doc.created_at)} • ${formatBytes(doc.metadata && doc.metadata.size)}</div>
        </div>
        ${!_isSelectMode ? `
        <div class="pb-doc-actions">
          <button class="pb-view-btn" data-action="view">VIEW</button>
          <button class="pb-del-btn" data-action="del">DEL</button>
        </div>` : ''}
      </div>`;
  }).join('');

  if (_isSelectMode) {
    html += `<button class="pb-cancel-btn" id="pb-cancel-select">Cancel Selection</button>`;
  }

  container.innerHTML = html;

  // Wire doc row events
  container.querySelectorAll('.pb-doc-row').forEach(function(row) {
    var name = row.dataset.name;

    if (_isSelectMode) {
      row.addEventListener('click', function() {
        var idx = _selectedFiles.indexOf(name);
        if (idx === -1) _selectedFiles.push(name);
        else _selectedFiles.splice(idx, 1);
        renderMyDocs();
      });
    } else {
      var viewBtn = row.querySelector('[data-action="view"]');
      var delBtn = row.querySelector('[data-action="del"]');
      if (viewBtn) viewBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        viewDocument(name, 'uploads');
      });
      if (delBtn) delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteDocument(name);
      });
      row.addEventListener('click', function() {
        viewDocument(name, 'uploads');
      });
    }
  });

  var cancelBtn = document.getElementById('pb-cancel-select');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      _isSelectMode = false;
      _selectedFiles = [];
      renderMyDocs();
    });
  }
}

// ─── VIEW DOCUMENT ────────────────────────────────────────────
async function viewDocument(fileName, folder) {
  var result = await sb.storage
    .from('client-documents')
    .createSignedUrl(folder + '/' + _clientEmail + '/' + fileName, 300);

  if (result.error) {
    alert('Could not open document. Please try again.');
    return;
  }
  window.open(result.data.signedUrl, '_blank');
}

// ─── DELETE DOCUMENT ──────────────────────────────────────────
async function deleteDocument(fileName) {
  if (!confirm('Remove "' + fileName + '"?')) return;
  var result = await sb.storage
    .from('client-documents')
    .remove(['uploads/' + _clientEmail + '/' + fileName]);

  if (result.error) {
    alert('Delete failed. Please try again.');
  } else {
    await fetchMyDocs();
  }
}

// ─── BULK DELETE ─────────────────────────────────────────────
async function bulkDelete() {
  var paths = _selectedFiles.map(function(n) {
    return 'uploads/' + _clientEmail + '/' + n;
  });
  var result = await sb.storage.from('client-documents').remove(paths);
  if (result.error) {
    alert('Could not complete bulk delete.');
  } else {
    _selectedFiles = [];
    _isSelectMode = false;
    await fetchMyDocs();
  }
}

// ─── UPLOAD ───────────────────────────────────────────────────
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
    if (barEl) barEl.style.width = Math.round(((i) / files.length) * 100) + '%';

    try {
      var clean = file.name.replace(/\s+/g, '_');
      var parts = clean.split('.');
      var ext = parts.length > 1 ? parts.pop() : '';
      var base = ext ? parts.join('.') : clean;
      var path = 'uploads/' + _clientEmail + '/' + base + '_' + Date.now() + (ext ? '.' + ext : '');

      var arrayBuffer = await file.arrayBuffer();
      var result = await sb.storage
        .from('client-documents')
        .upload(path, arrayBuffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true
        });

      if (result.error) throw result.error;
      ok++;
    } catch (e) {
      fail++;
    }
  }

  if (barEl) barEl.style.width = '100%';
  if (statusEl) statusEl.textContent = ok + ' file(s) uploaded' + (fail ? ', ' + fail + ' failed' : '') + '.';

  setTimeout(function() {
    if (progressEl) progressEl.style.display = 'none';
    if (barEl) barEl.style.width = '0';
  }, 2500);

  if (labelEl) labelEl.textContent = 'Upload Documents';
  if (uploadBtn) uploadBtn.disabled = false;

  await fetchMyDocs();
}

// ─── ESCAPE HTML ─────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── TRIGGER ON LOAD ─────────────────────────────────────────
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
