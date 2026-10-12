# Privacy and security

Seekto is built so that nobody, including the people who make it, needs to see your notes. This page says exactly what goes where.

## On your device

Notes, recordings, your calendar, assignments and settings are stored in your browser (IndexedDB and localStorage). There is no Seekto server and no Seekto account. The app's code and fonts are served from GitHub Pages; after the first visit a service worker keeps a copy so the app opens offline. There are no analytics or trackers.

| Feature | What leaves your device | Who sees it |
|---|---|---|
| Live transcript (browser) | Audio, while you record | Your browser's speech service (online in Chrome and Edge) |
| Private transcript (on device) | Nothing. The Whisper model and the Transformers.js library are downloaded once (from Hugging Face and jsDelivr) and cached | Those sites see a download request, not your audio |
| AI model (off by default) | The question and the note excerpts it needs | Only the provider you choose; your key stays on the device |
| Shared practice test | The questions, inside the link | Whoever you send the link to. The part after `#` is never sent to a server |
| Device sync | Connection setup: device names, random ids, network addresses | The message service (ntfy.sh or your own). Your data goes directly between devices, encrypted (WebRTC) |
| Storage sync (optional) | Encrypted items | Your own Supabase project, which sees only ciphertext |

## Connecting devices

A new device needs the 6-letter code (valid for 10 minutes) and a tap on **Allow** on the device showing it. The two devices then share a random secret over their encrypted connection. When they reconnect, each proves it knows the secret. The proof is tied to that connection's fingerprints and to the device proving it, so it can't be replayed, relayed or reflected. Devices on networks that block direct connections (some school and office networks) may not be able to connect; the same Wi-Fi helps.

## Your account and storage

There is no sign-up. Turning on storage creates an **account key**: 23 random characters plus a check character (about 114 bits). From it, HKDF derives:

- an account id, which says which rows are yours;
- a write token, which the database stores only as a SHA-256 hash;
- a key that turns record names into opaque ids;
- the AES-GCM key that encrypts every item.

Each item is encrypted on the device and bound to its account, item id and version, so the database can't read it, swap items or pass an old version off as new. Your storage sees account ids, opaque item ids, version numbers, sizes and timing. It never sees text or audio. Its tables are closed to direct access, and the app only calls a few functions that check the write token. Older versions are refused. The script is [`app/supabase.sql`](../app/supabase.sql), and CI runs it against Postgres on every change.

**Adding a device:** type the key or use the recovery kit, or tap "Get it from a connected device". In the last case both screens show the same 4-digit number from the connection's fingerprints, and you tap Allow.

**Changing the key:** Seekto encrypts everything again with a new key, uploads it and deletes the old copy, so a lost device or a key someone saw stops working.

**Losing the key:** if you lose the key and all your devices, nobody can recover the data. That is the cost of real end-to-end encryption.

## Known limits

- The account key is kept in the browser's storage on each device you add, so anyone who can use that browser profile can read your data. Use your device's lock screen.
- A cross-site scripting bug in the app could expose data in the browser. The app escapes notes and shared content before showing them, and loads third-party code only when you ask for it: YouTube's player when you add a video, and Transformers.js (pinned version, from jsDelivr) when you turn on on-device transcription.
- This hasn't had an outside security review yet. It is on the launch checklist. Please report issues as described in [SECURITY.md](../SECURITY.md).
