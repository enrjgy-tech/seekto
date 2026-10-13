# Privacy and security

Seekto is built so that nobody, including the people who make it, needs to see your notes. This page says exactly what goes where.

## On your device

Notes, recordings, your calendar, assignments and settings are stored in your browser (IndexedDB and localStorage). There is no Seekto server and no Seekto account, but some features use other services; the table below lists every one. The app's code and fonts are served from GitHub Pages; after the first visit a service worker keeps a copy so the app opens offline. There are no analytics or trackers.

| Feature | What leaves your device | Who sees it |
|---|---|---|
| Private transcript (on device, the default on computers) | Nothing. The Whisper model and the Transformers.js library are downloaded once (from Hugging Face and jsDelivr) and cached | Those sites see a download request, not your audio |
| Live transcript (browser speech service, the default on phones) | Audio, while you record | Your browser maker's speech service: Google in Chrome, Microsoft in Edge, Apple in Safari |
| Answering a quiz out loud, talk mode, the chat microphone | Audio, while the microphone is on | The same browser speech service. Shared tests don't offer it |
| Reading answers aloud (talk mode) | The text being read | Your browser's voice. Most voices run on the device, but some (for example Chrome's "Google" voices) are online |
| AI model (off by default) | The question and the note excerpts it needs | Only the provider you choose; your key stays on the device |
| Shared practice test | The questions, inside the link (and your score, if you send it back) | Whoever you send the link to. The part after `#` is never sent to a server |
| Device sync: finding each other | Device names (like "Windows PC", which you can rename), random ids and connection details, including network addresses | The message service (ntfy.sh, or your own). Topics on ntfy.sh are public: anyone who knows a topic name can read it, which is why nothing private is sent there and why a first connection is checked with a number on both screens. Each device listens on a topic named after its random id, so the service can tell when that device is online and from which address |
| Device sync: connecting | Your public IP address | Two STUN servers (Google and Cloudflare) that tell each device its own address |
| Device sync: your data | Notes, recordings, calendar, assignments | Only your other device, directly and encrypted (WebRTC). Networks that block direct connections can stop it |
| Storage sync (optional) | Encrypted items | Your own Supabase project, which sees only ciphertext |
| Videos in Research | The video id; YouTube's player script is loaded from youtube.com | YouTube. The video plays in its no-cookie player, but loading the player itself contacts youtube.com |

## Connecting devices

A new device needs the 6-character pairing code (valid for 10 minutes). The code travels through the public message service, so on its own it couldn't stop whoever runs that service from sitting in the middle. That's why, once the two devices are connected, **both screens show the same 6-digit number**, and you tap Allow only if they match. The number comes from this connection's fingerprints and from random values each device committed to before seeing the other's, so someone in the middle gets two different connections and only a one-in-a-million chance of making the numbers match.

After you allow it, the two devices share a random secret over their encrypted connection. When they reconnect, each proves it knows the secret. The proof is tied to that connection's fingerprints and to the device proving it, so it can't be replayed, relayed or reflected.

## Your account and storage

There is no sign-up. Turning on storage creates an **account key**: 23 random characters plus a check character (about 114 bits). From it, HKDF derives:

- an account id, which says which rows are yours;
- a write token, which the database stores only as a SHA-256 hash;
- a key that turns record names into opaque ids;
- the AES-GCM key that encrypts every item.

Each item is encrypted on the device and bound to its account, item id and version, so the database can't read it, swap items or pass an old version off as new. Your storage sees account ids, opaque item ids, version numbers, sizes and timing. It never sees text or audio. Its tables are closed to direct access, and the app only calls a few functions that check the write token. Older versions are refused. Because the browser key for your project is not a secret (it's in the recovery kit), the database accepts at most 10 accounts and each account at most about 300 MB of encrypted data. That limits how much someone holding the key could add, but it doesn't make it impossible: 10 accounts could still store more than a free Supabase project holds, and unused account slots can be claimed by anyone with the key. Keep the recovery kit private, and lower `seekto_max_accounts` or `seekto_max_bytes` in the script to fit your project. The script is [`app/supabase.sql`](../app/supabase.sql), and CI runs it against Postgres on every change.

**Adding a device:** type the key or use the recovery kit, or tap "Get it from a connected device". In the last case both screens show the same 6-digit number from the connection's fingerprints, and you tap Allow.

**Changing the key:** Seekto encrypts everything again with a new key, uploads it and deletes the old copy, so a lost device or a key someone saw stops working.

**Losing the key:** if you lose the key and all your devices, nobody can recover the data. That is the cost of real end-to-end encryption.

## Known limits

- The account key is kept in the browser's storage on each device you add, so anyone who can use that browser profile can read your data. Use your device's lock screen.
- The live site runs on `enrjgy-tech.github.io`, an address shared with any other GitHub Pages site of that account, so browser storage there is shared with those pages. For the strongest separation, run your own copy on its own address (see [SELF-HOSTING.md](SELF-HOSTING.md)).
- A cross-site scripting bug in the app could expose data in the browser. The app's Content Security Policy only lets scripts load from the app itself, jsDelivr and YouTube, but it allows connections to any address, because you can point Seekto at your own AI, storage and message servers. The app escapes notes and shared content before showing them, and loads third-party code only when you ask for it: YouTube's player when you add a video, and Transformers.js (pinned version, from jsDelivr) when you turn on on-device transcription.
- This hasn't had an outside security review yet. It is on the launch checklist. Please report issues as described in [SECURITY.md](../SECURITY.md).
