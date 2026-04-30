// 1. SETUP & CONFIGURATION
var SUPABASE_URL = 'https://plcdgqwrwwitkmbsghkh.supabase.co';
var SUPABASE_KEY = 'sb_publishable_4EEUEcMMNlkSM7oxSJ0hiQ_zsBdam0T';
var sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. CONTACT FORM LOGIC
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

// 3. CLERK SYNC LOGIC
async function syncUserToSupabase() {
    if (!window.Clerk || !window.Clerk.user) return;

    const user = window.Clerk.user;
    console.log("Syncing user:", user.primaryEmailAddress.emailAddress);
    
    const { data, error } = await sb
        .from('leads')
        .upsert({ 
            id: user.id, 
            email_address: user.primaryEmailAddress.emailAddress,
            full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            last_seen: new Date().toISOString()
        }, { onConflict: 'id' });

    if (error) console.error("Sync Error:", error.message);
}

// 4. LOAD CLIENT DOCUMENTS & PERSONALIZED GREETING
async function loadClientDocuments() {
    const dashboard = document.getElementById('client-dashboard');
    const displayArea = document.getElementById('document-list');
    const greetingArea = document.getElementById('user-greeting');
    
    const user = window.Clerk.user;
    
    // Hide dashboard if no user is logged in
    if (!user) {
        if (dashboard) dashboard.style.display = 'none';
        return;
    }

    // UPDATE GREETING: This is the fix for the name
    if (greetingArea) {
        // Try First Name, then Full Name, then Email prefix as last resort
        const displayName = user.firstName || 
                          (user.fullName && user.fullName.split(' ')[0]) || 
                          user.primaryEmailAddress.emailAddress.split('@')[0];
        
        greetingArea.innerText = `Welcome ${displayName},`;
    }

    // Show the dashboard container
    if (dashboard) dashboard.style.display = 'block';

    // Fetch documents linked to this specific Clerk ID
    const { data: docs, error } = await sb
        .from('client_documents')
        .select('*')
        .eq('client_id', user.id);

    if (error) {
        if (displayArea) displayArea.innerHTML = `<p style="color: red;">Error loading documents.</p>`;
        return;
    }

    // Render the Attractive Document Cards
    if (displayArea) {
        if (docs.length === 0) {
            displayArea.innerHTML = `
                <div style="background: #f9fbff; border: 1px dashed #d1d9e6; padding: 20px; border-radius: 8px; text-align: center; color: #777;">
                    No documents found. Your account manager will upload them shortly.
                </div>`;
        } else {
            displayArea.innerHTML = docs.map(doc => `
                <div style="background: #fff; border: 1px solid #edeef0; padding: 15px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; transition: 0.3s;" onmouseover="this.style.borderColor='#0052cc'" onmouseout="this.style.borderColor='#edeef0'">
                    <div>
                        <div style="font-weight: 600; color: #333;">${doc.document_name}</div>
                        <div style="font-size: 0.75rem; color: #0052cc; text-transform: uppercase; font-weight: bold; margin-top: 4px;">${doc.category || 'Tax Record'}</div>
                    </div>
                    <a href="${doc.file_url}" target="_blank" style="background: #0052cc; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 0.85em; font-weight: 500;">
                        View Document
                    </a>
                </div>
            `).join('');
        }
    }
}

// 5. TRIGGER ON LOAD
window.addEventListener('load', () => {
    // We wait 2 seconds to be absolutely sure Clerk is ready
    setTimeout(() => {
        syncUserToSupabase();
        loadClientDocuments();
    }, 2000);
});
