# Buzz: the news, made plain

A website that works like an app on your iPhone. It pulls headlines from trusted outlets around the world, groups reports of the same event, explains each story in plain words, reads it aloud, remembers what you search for, and can send one or two notifications a day at times you choose.

It costs nothing to run. Every part below says whether it is **done and tested** or **built but not tested live**, because some things cannot be tested until the site is on the internet.

## What is in this version

| Part | What it does | Status |
|---|---|---|
| Headlines | 25 feeds from BBC, Guardian, Al Jazeera, The Hindu, NPR, DW across 10 topics, refreshed 3 times a day | Code tested. **Feed addresses not yet fetched live** (first run is the real test) |
| Story grouping | Same event from different outlets becomes one card. Shows "2 independent outlets" or "Single source" | Tested |
| Quick read | AI explains each story for an 18-year-old. **Simplify more** gives a longer version for a 12-year-old with extra word definitions. Also "Confirmed / Claimed / Still unknown" | Safety checks tested with a fake AI. **Not tested with the real AI** until you add a key |
| Full explanation | Background, what happened so far, who is affected, predictions (reported ones kept apart from the AI's own reasoning), expected vs actual numbers, up to 8 word definitions | Same as above |
| Charts | Real public data (US Fed, inflation, jobs, oil, rupee, GDP and more). Code picks the chart from headline words, downloads the numbers, and names the source under each chart. No chart appears when no real data fits | Code tested with fake downloads. **Never fetched live** until your first run |
| Select a word | Select any word or sentence in an explanation and a sheet explains it in the context of that story | Tested with a fake helper. Needs Part 4 |
| Source links | Every card and story page links to the original outlet; the story page lists every outlet that reported it | Done |
| Listen | Reads the explainer aloud with your phone's own voice. Free | Tested with a stand-in voice. **Try it on your iPhone** |
| Search + My Tracked | Search anything. Every search is saved on your device and checked against new stories | Tested |
| Settings | Choose topics, turn search-saving off, delete everything | Tested |
| Notifications | Up to 2 a day at your chosen times, tapping opens the story with a Listen button | Code and logic tested. **Never sent to a real phone** |
| Mascot and art | Bee-Bee and a scene for each topic, all drawn in code, all original | Done |

## Set it up

You need a free GitHub account. Do Part 1 first. Parts 2 and 3 are optional and can wait.

### Part 1: put the site online (about 15 minutes, on a computer)

1. **Make an account** at github.com.
2. **Create a repository.** Click **+**, then **New repository**. Name it `buzz`. Choose **Public** (required for the free plan). Click **Create repository**.
3. **Upload the files.** Unzip the download. On the new repository page click **uploading an existing file**, drag in everything from inside the unzipped folder (files and folders, not the folder itself), then **Commit changes**.
   - Check that a folder called `.github` appears. If it is missing, click **Add file, then Create new file**, type `.github/workflows/site.yml` as the name, paste in that file's contents from the zip, and commit. Repeat for `digests.yml`.
   - Do **not** upload the `node_modules` folder if you have one.
4. **Turn on publishing.** **Settings, then Pages**, under **Source** choose **GitHub Actions**.
5. **Allow saving updates.** **Settings, then Actions, then General**, under **Workflow permissions** choose **Read and write permissions**, **Save**.
6. **Run it once.** **Actions** tab, **Refresh news and publish site**, **Run workflow**. Wait 2 to 3 minutes for a green tick.
7. **Open your site** at `https://YOUR-USERNAME.github.io/buzz/` in **Safari on your iPhone**.
8. **Install it.** Share button, **Add to Home Screen**. Open Buzz from that icon from now on.

**How to check it worked:** the yellow "Demo data" notice is gone and you see real headlines. At the bottom, each source says "updated ... ago". Any that say "last update failed" have a wrong feed address; tell me which. The **Actions** tab, latest run, **Fetch latest headlines** step lists every source as ok or the error.

### Part 2: switch on the AI explainers (free, about 10 minutes)

1. Go to **aistudio.google.com**, sign in, and create an API key. **Do not turn on billing** for that project, so it cannot charge you.
2. In AI Studio, check which models your free key can use and their daily limits. Limits change, and I could not confirm today's.
3. In your GitHub repository: **Settings, Secrets and variables, Actions, New repository secret**. Name `GEMINI_API_KEY`, paste the key.
4. If the model name needs changing, add a **variable** (same page, Variables tab) named `GEMINI_MODEL`. The default is `gemini-2.5-flash`.
5. **For the US charts (optional, free):** make a key at fred.stlouisfed.org (My Account, API Keys) and add it as a secret named `FRED_API_KEY`. Without it, charts for India, China, UK, Japan and the US GDP (World Bank data) still work; Fed rates, US inflation, oil, the rupee and the S&P 500 do not.
6. Run the workflow again. In the log, **Write plain-language explainers** shows how many were written and how many AI calls were used today.

Each story now gets a bigger write-up, so one run takes longer and uses more of your free allowance. Safety limits built in: at most 25 AI calls per run and 120 per day, one call per story version (never repeated), a stop at the first quota error, and it never switches to a different model by itself. If the AI is off or fails, stories just show without an explainer.

**Privacy note:** on Google's free tier, what you send may be used to improve Google products. Buzz sends only public headlines and snippets, never anything about readers.

### Part 3: switch on notifications (free, about 30 minutes, needs a computer)

Optional. Notifications on iPhone only work for the app installed on the Home Screen (iOS 16.4 or later).

1. **Database.** Make a free account at supabase.com and create a project. Open **SQL Editor, New query**, paste all of `supabase/schema.sql`, **Run**.
2. **Keys for the phone side.** In Supabase **Settings, API** copy the **Project URL** and the **anon public** key.
3. **Notification keys.** On a computer with Node, in the project folder run `npm run vapid`. It prints a public and a private key.
4. **Edit `config.js`** on GitHub (pencil icon): paste the Project URL, the anon key and the VAPID **public** key. These three are safe to be public.
5. **Add secrets** in GitHub (Settings, Secrets and variables, Actions): `SUPABASE_URL` (same URL), `SUPABASE_SERVICE_ROLE_KEY` (Supabase, Settings, API, the **service_role** key, keep it private), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (the private one from step 3), `VAPID_SUBJECT` (`mailto:` plus your email).
6. **Try it.** Open Buzz from the Home Screen, **Settings, Notifications**, pick a time a few minutes ahead, **Turn on notifications**, allow the prompt. The sender runs every 30 minutes (**Actions, Send notifications, Run workflow** to run it now). A message arrives within about 50 minutes after your chosen time.

If anything fails, tell me exactly what the screen or the Actions log says.

### Part 4: switch on "select a word to explain" (free, about 15 minutes)

Optional. This needs a tiny free helper because the AI key must never sit inside the website. You use the same Gemini key as Part 2.

1. Make a free account at **cloudflare.com**. Open **Workers & Pages, Create, Create Worker**, name it `buzz-ask`, **Deploy**, then **Edit code**.
2. Delete the sample code and paste in all of `worker/ask.mjs` from this project. **Deploy**.
3. In the Worker open **Settings, Variables and Secrets** and add:
   - secret `GEMINI_API_KEY`: the same key as Part 2
   - secret `ASK_CODE`: a private password you invent (letters and numbers)
   - text variable `ALLOWED_ORIGIN`: your site address with no slash at the end, for example `https://yourname.github.io`
4. Copy the Worker address (it ends in `.workers.dev`). On GitHub edit `config.js` and paste it into `askUrl`, in quotes. Commit.
5. Open Buzz, **Settings, AI helper for words**, type your `ASK_CODE` once. Now open any explanation and select a word.

Safety: the helper refuses anything without your code or from another website, cleans what it sends and gets back, and answers in about 80 words. Keep the Gemini key on the free plan so it can only ever run out for the day, never charge you.

## Changing things

- **Sources:** edit `data/sources.json`. `"active": false` switches one off. `group` stops two feeds from one outlet counting as two independent sources.
- **Topics:** edit `data/topics.json`.
- **Art:** `scenes.js` (mascot + 12 topic scenes) and `motifs.js` (35 headline pictures: ceasefire, shares up/down, cricket, chips, space and more). A card gets the picture whose keywords match its headlines; if none match it falls back to the topic scene. Open `art.html` on your site to see all of them. Pictures are drawn in code, never from feed content.

## For developers

```
npm test            # 68 automated tests (feeds, grouping, AI checks, search, speech, notifications)
npm run ingest      # fetch feeds, group stories
npm run explain     # write explainers (needs GEMINI_API_KEY)
npm run digests     # send due notifications (needs the secrets in Part 3)
npm run vapid       # make notification keys
npm run serve       # preview at http://localhost:8080
python3 scripts/make_icons.py   # redraw icons (needs Pillow)
```

## Rules the code follows

- Only a headline, a short snippet (220 characters), a link, publisher and date are stored. Never full articles.
- Text from feeds and from the AI is shown as plain text only. Script and style content is removed. A strict content policy blocks outside scripts and styles.
- "Confirmed" requires two **independent** outlets. The code decides this, not the AI. Two feeds from one outlet, or the same wire copy (Reuters, AP, AFP, PTI) count once.
- Every number in an explainer must appear in the source headlines or snippets, or in the public data the code downloaded for the chart, or the explainer is rejected. Charts are drawn only from downloaded data, never from AI output.
- A prediction is labelled "reported" only if it cites an outlet. Anything else is shown as the AI's own reasoning.
- Too little information produces "not enough information", never a guess.
- Notifications: at most one per chosen time, two a day, never the same story twice, nothing when there is nothing new.
- A feed that fails 5 times is paused for 24 hours. If every feed fails, the old headlines stay.

## Known limits (please read)

- **This is a personal project, not a product.** Buzz shows only headlines, short snippets and links, but the news feeds are not licensed for a commercial service, so do not sell it, run ads on it or charge for it. Sharing the link with friends for free is a grey area worth checking against each publisher's terms.
- **Charts only appear for topics the code knows** (about 20 data series). Many stories will have no chart. That is deliberate: no real data means no chart.
- **Background is the AI's general knowledge**, labelled as such. The history in charts is real data; the history in words is not checked.

- **"Independent outlets" means widely reported, not true.** Buzz cannot promise unbiased or verified news. It shows who reported what and links to them.
- **Feed addresses and terms.** The feed URLs came from public lists and were not fetched live. Check each publisher's feed terms before sharing the site widely (Al Jazeera, Guardian, The Hindu, NPR, DW especially).
- **Explainers are AI-written from headlines and snippets only**, so they can miss detail or be wrong. The "Background" section is general knowledge and is labelled as not from the reports.
- **Search only covers about the last week** of Buzz's sources. Quiet topics may show nothing.
- **Clustering is conservative.** Two reports of one event may stay as two cards. It is tuned never to merge different events, and it has not been tuned on real feed data yet.
- **No accounts.** Your profile lives in your browser. Clearing Safari data, or using the Home Screen app vs Safari (they keep separate storage), means starting fresh there. Turning notifications on stores your times, topics and tracked terms on a server until you turn them off.
- **Scheduled jobs:** GitHub can delay them by many minutes and disables schedules on public repositories after 60 days with no activity. The daily data commits normally count as activity. If updates stop, press **Run workflow**.
- **Free-tier services change.** Supabase pauses a free project after a week with no activity, so notifications could stop if nobody has used them for a week. AI free limits can change.
- **The handwriting font depends on the phone.** iPhones have suitable ones built in.
- **Not tested on a real iPhone.** All browser tests ran in a desktop test browser set to an iPhone size.
- The name "Buzz" has not been checked for trademark or domain conflicts.
