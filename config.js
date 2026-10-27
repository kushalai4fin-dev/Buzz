// Public settings (notifications and the word helper). These values are SAFE to be public (they are public by design).
// Leave them empty and Buzz works fully, minus notifications. See README, "Turn on notifications".
// Never put a secret key (service_role, VAPID private key, AI key) in this file.
window.BUZZ_CONFIG = {
  supabaseUrl: '',      // e.g. https://abcdxyz.supabase.co
  supabaseAnonKey: '',  // the "anon public" key from Supabase, Settings, API
  vapidPublicKey: '',   // public half of the VAPID key pair made by: npm run vapid
  askUrl: ''            // address of your free word-explaining helper, e.g. https://buzz-ask.yourname.workers.dev (README, Part 4)
};
