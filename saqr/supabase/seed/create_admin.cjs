const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.resolve(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  const email = 'admin@saqr.com';
  const password = 'saqr2026';

  console.log(`Creating admin user: ${email}...`);

  // 1. Create the user in Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Saqr Admin' }
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('User already exists in Auth. Proceeding to elevation...');
    } else {
      console.error('Auth Error:', authError.message);
      return;
    }
  }

  // 2. Elevate to Admin in Profiles table
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      role: 'admin', 
      status: 'active'
    })
    .eq('email', email);

  if (profileError) {
    console.error('Profile Update Error:', profileError.message);
  } else {
    console.log('Successfully elevated to Admin role! ✅');
    console.log('You can now log in with:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  }
}

createAdmin();
