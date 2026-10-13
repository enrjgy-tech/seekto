# Running your own Seekto

Seekto is a static site. Your notes live in each person's browser, not on the server, so hosting it is just serving files. Running your own copy gives it its own web address (so no other site shares its browser storage), lets you keep every request on your network, and lets a school or club offer it under its own name.

## 1. Serve the site

Any static file server works.

```sh
git clone https://github.com/enrjgy-tech/seekto.git && cd seekto
npm run build          # writes ./site
npx serve site         # or nginx, Caddy, Apache, GitHub Pages, Netlify...
```

With Docker:

```sh
docker build -t seekto .
docker run -d -p 8080:80 --name seekto seekto
```

Open `http://localhost:8080`. Browsers only allow the microphone and offline mode on `https://` addresses (and `localhost`), so put it behind HTTPS for other devices, for example with Caddy:

```
seekto.example.org {
  reverse_proxy localhost:8080
}
```

## 2. Keep on-device transcription on your server (optional)

By default, the first private transcript downloads Transformers.js from jsDelivr and the Whisper model from Hugging Face (then the browser keeps them). To serve both yourself, run this once on a machine with internet access, after building:

```sh
node pipeline/vendor-whisper.mjs              # fast and better models, about 120 MB
node pipeline/vendor-whisper.mjs tiny base small
```

It copies everything into `site/vendor/` and `site/models/` and points `site/js/config.js` at them. With Docker: `docker build --build-arg VENDOR_WHISPER=1 -t seekto .`

This script is new and hasn't been tested end to end yet. If it fails for you, please [open an issue](https://github.com/enrjgy-tech/seekto/issues) with the output.

## 3. Connecting devices on your own network (optional)

Devices find each other through an [ntfy](https://ntfy.sh) server. Only connection setup goes through it; the data goes directly between devices, and a first connection is checked with a number on both screens. To use your own:

```sh
docker run -d -p 2586:80 --name ntfy binwiederhier/ntfy serve
```

Then in Seekto: **Settings → More → Connection server**, enter `https://ntfy.your-server`.

Some school and office networks block direct connections between devices. A TURN server relays the (still encrypted) connection. With [coturn](https://github.com/coturn/coturn):

```sh
docker run -d --network=host coturn/coturn -n --listening-port=3478 --realm=seekto --user=seekto:choose-a-password --lt-cred-mech
```

Then in **Settings → More → Connection server → STUN and TURN servers**:

```json
[{ "urls": "turn:turn.your-server:3478", "username": "seekto", "credential": "choose-a-password" }]
```

## 4. Encrypted storage (optional)

Storage sync works with any Supabase project, including [self-hosted Supabase](https://supabase.com/docs/guides/self-hosting). Run [`app/supabase.sql`](../app/supabase.sql) in its SQL editor. It accepts at most 10 accounts of about 300 MB each; change `seekto_max_accounts` and `seekto_max_bytes` in the script to fit your project (a free Supabase project holds 500 MB). Everything is encrypted before it leaves the browser.

Adapters for WebDAV (Nextcloud) and S3-compatible storage are open issues, and help is welcome.

## What a self-hosted copy still contacts

Nothing, unless someone turns a feature on: an AI provider they choose, YouTube's player in Research, the browser's own speech service if they pick live transcripts, and the connection and storage servers above.
