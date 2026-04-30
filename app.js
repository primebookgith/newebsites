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
