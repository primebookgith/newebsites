// app.js
const SUPABASE_URL = 'https://plcdgqwrwwitkmbsghkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4EEUEcMMNlkSM7oxSJ0hiQ_zsBdam0T';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const contactForm = document.getElementById('contactForm');

contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;

    const { data, error } = await supabase
        .from('leads') 
        .insert([{ email_address: email, message_content: message }]);

    if (error) alert("Error: " + error.message);
    else alert("Success!");
});
// This is a comment, it won't cause an error in app.js
async function syncUserToSupabase() {
    if (!window.Clerk || !window.Clerk.user) return;

    const user = window.Clerk.user;
    
    // Using upsert to add or update the client info
    const { data, error } = await supabase
        .from('leads')
        .upsert({ 
            id: user.id, 
            email_address: user.primaryEmailAddress.emailAddress,
            full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            last_seen: new Date().toISOString()
        }, { onConflict: 'id' });

    if (error) console.error("Error:", error.message);
}
