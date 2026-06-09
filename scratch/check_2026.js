const supabaseUrl = 'https://vhvioxzmanwbcuxzcuga.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodmlveHptYW53YmN1eHpjdWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTY2MjQsImV4cCI6MjA5NjQ5MjYyNH0.NAyc8GADmCY3vk2e4JL-eN6TgTF_9_kNfm8CawluuJo';

async function run() {
  const url = `${supabaseUrl}/rest/v1/fin_transactions?type=eq.income&date=gte.2026-01-01`;
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  if (!res.ok) {
    console.error('Fetch failed:', res.status, await res.text());
    return;
  }

  const data = await res.json();
  console.log('Income transactions in 2026:', data);
}

run();
