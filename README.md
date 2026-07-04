# Astrogem Cutter

Share your screen while cutting Lost Ark Astrogems. It watches for the
processing screen and tells you: **Process**, **Reroll**, or **Stop**.

Your Anthropic API key stays on the server (`api/analyze.js`) — it's never
sent to the browser, so this is safe to deploy publicly.

## Deploy it (5 minutes, no coding needed)

**1. Get an Anthropic API key**
Go to https://console.anthropic.com/settings/keys, create a key, copy it.
Note: API usage is billed separately from any Claude.ai subscription — you'll
need billing set up on that console account. Each "Read Now" costs a few
cents at most.

**2. Create a free Vercel account**
Go to https://vercel.com and sign up (GitHub login is easiest).

**3. Get this code onto GitHub**
- Create a new empty repo on https://github.com/new (call it `astrogem-cutter`)
- Upload all the files in this folder to that repo (drag-and-drop works fine
  on GitHub's web UI — "Add file" → "Upload files")

**4. Import into Vercel**
- In Vercel, click "Add New… → Project"
- Pick the `astrogem-cutter` repo you just created
- Before clicking Deploy, open "Environment Variables" and add:
  - Name: `ANTHROPIC_API_KEY`
  - Value: (paste the key from step 1)
- Click Deploy

**5. Open your site**
Vercel gives you a URL like `astrogem-cutter.vercel.app`. Open it, click
"Start & Share Screen," and pick your Lost Ark window.

## Updating later
Any time you push changes to the GitHub repo, Vercel redeploys automatically.

## Files
- `index.html` — the whole frontend (UI, screen capture, polling logic)
- `api/analyze.js` — serverless function that holds your API key and talks to
  Anthropic on the frontend's behalf
