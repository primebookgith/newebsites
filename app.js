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
