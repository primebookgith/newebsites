// 1. Setup - Using 'sb' instead of 'supabase' to avoid naming conflicts
var SUPABASE_URL = 'https://plcdgqwrwwitkmbsghkh.supabase.co';
var SUPABASE_KEY = 'sb_publishable_4EEUEcMMNlkSM7oxSJ0hiQ_zsBdam0T';

// We check the global 'supabase' library to create our 'sb' client
var sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Form Logic
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;

        const { data, error } = await sb
            .from('leads') 
            .insert([{ email_address: email, message_content: message }]);

        if (error) alert("Error: " + error.message);
        else alert("Success!");
    });
}

// 3. Clerk Sync Logic
async function syncUserToSupabase() {
    // Wait for Clerk to be fully ready
    if (!window.Clerk || !window.Clerk.user) return;

    const user = window.Clerk.user;
    console.log("Syncing user to Supabase:", user.primaryEmailAddress.emailAddress);
    
    const { data, error } = await sb
        .from('leads')
        .upsert({ 
            id: user.id, 
            email_address: user.primaryEmailAddress.emailAddress,
            full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            last_seen: new Date().toISOString()
        }, { onConflict: 'id' });

    if (error) console.error("Sync Error:", error.message);
    else console.log("User successfully synced to Supabase!");
}

// 4. Trigger the sync when the page loads or user signs in
window.addEventListener('load', () => {
    // Small delay to ensure Clerk is initialized
    setTimeout(() => {
        syncUserToSupabase();
    }, 1500);
});

async function loadClientDocuments() {
    const user = window.Clerk.user;
    if (!user) return;

    // Fetch documents where client_id matches the logged-in user
    const { data: docs, error } = await sb
        .from('client_documents')
        .select('*')
        .eq('client_id', user.id);

    if (error) {
        console.error("Error loading docs:", error.message);
        return;
    }

    const displayArea = document.getElementById('document-list');
    if (!displayArea) return;

    if (docs.length === 0) {
        displayArea.innerHTML = "<p>No documents found for your account.</p>";
    } else {
        // Create a simple list of clickable links
        displayArea.innerHTML = docs.map(doc => `
            <div style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>${doc.document_name}</strong> (${doc.category})<br>
                <a href="${doc.file_url}" target="_blank" style="color: blue;">Download PDF</a>
            </div>
        `).join('');
    }
}

// Update your existing load listener to also call this function
window.addEventListener('load', () => {
    setTimeout(() => {
        syncUserToSupabase();
        loadClientDocuments(); // NEW: Load docs after syncing
    }, 1500);
});

async function loadClientDocuments() {
    const dashboard = document.getElementById('client-dashboard');
    const displayArea = document.getElementById('document-list');
    
    // 1. Check if user is logged in
    const user = window.Clerk.user;
    
    if (!user) {
        if (dashboard) dashboard.style.display = 'none';
        return;
    }

    // 2. Reveal the dashboard for the logged-in client
    dashboard.style.display = 'block';

    // 3. Fetch from Supabase
    const { data: docs, error } = await sb
        .from('client_documents')
        .select('*')
        .eq('client_id', user.id);

    if (error) {
        displayArea.innerHTML = `<p style="color: red;">Error loading records. Please contact support.</p>`;
        return;
    }

    // 4. Create attractive "Document Cards"
    if (docs.length === 0) {
        displayArea.innerHTML = `
            <div style="background: #f9fbff; border: 1px dashed #d1d9e6; padding: 20px; border-radius: 8px; text-align: center; color: #777;">
                No documents found. Your account manager will upload them shortly.
            </div>`;
    } else {
        displayArea.innerHTML = docs.map(doc => `
            <div style="background: #fff; border: 1px solid #edeef0; padding: 15px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; transition: 0.3s; cursor: pointer;" onmouseover="this.style.borderColor='#0052cc'" onmouseout="this.style.borderColor='#edeef0'">
                <div>
                    <div style="font-weight: 600; color: #333;">${doc.document_name}</div>
                    <div style="font-size: 0.75rem; color: #0052cc; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; margin-top: 4px;">${doc.category || 'General'}</div>
                </div>
                <a href="${doc.file_url}" target="_blank" style="background: #0052cc; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 0.85em; font-weight: 500;">
                    View PDF
                </a>
            </div>
        `).join('');
    }
}

// Ensure this is inside your window listener
window.addEventListener('load', () => {
    setTimeout(() => {
        syncUserToSupabase();
        loadClientDocuments();
    }, 1500);
});
