// Makes the key pair that proves notifications come from your site. Run once:  npm run vapid
// PUBLIC key  -> goes in config.js (safe to publish)
// PRIVATE key -> goes in GitHub Secrets as VAPID_PRIVATE_KEY (never in a file, never in chat)
import { createECDH } from 'node:crypto';

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
console.log('VAPID_PUBLIC_KEY  (put in config.js as vapidPublicKey):');
console.log(b64url(ecdh.getPublicKey()));
console.log('');
console.log('VAPID_PRIVATE_KEY (put in GitHub Secrets, keep private):');
console.log(b64url(ecdh.getPrivateKey()));
