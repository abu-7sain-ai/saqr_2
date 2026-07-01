const fs = require('fs');

async function activateAviator() {
  const supabaseUrl = 'https://ypxraakxwniedjubqccj.supabase.co';
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlweHJhYWt4d25pZWRqdWJxY2NqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA0MzI1OCwiZXhwIjoyMDg5NjE5MjU4fQ.kAXQoBflKvfLcq8qpKNLbGxTnCB4oEp8BeA0xVBAL3w';
  
  try {
    // 1. Get User ID
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const profiles = await profileResponse.json();
    if (!profiles.length) throw new Error("No user found");
    const userId = profiles[0].id;

    console.log(`Found User ID: ${userId}`);

    // 2. Insert Aviator Worker
    const workerData = {
      user_id: userId,
      number: 2,
      name: 'طيار الأمير 01',
      type: 'paper',
      market_type: 'volatile',
      owner: 'prince',
      status: 'running',
      strategy_name: 'aviator_volatile',
      starting_capital: 3000,
      current_capital: 3000
    };

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/workers`, {
      method: 'POST',
      headers: { 
        'apikey': serviceKey, 
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(workerData)
    });

    if (insertResponse.ok) {
      console.log("Successfully activated Aviator Prince 01! 🦅🚀");
    } else {
      const error = await insertResponse.text();
      console.error("Failed to activate:", error);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

activateAviator();
