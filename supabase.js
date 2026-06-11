// ============================================================
// Supabase config — replace the two values below with yours.
// Dashboard → your project → Settings → API
// ============================================================

const SUPABASE_URL  = 'YOUR_SUPABASE_URL';   // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
