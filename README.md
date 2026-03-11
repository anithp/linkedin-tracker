# LinkedIn Activity Tracker

A Chrome extension that **passively tracks your LinkedIn outreach and engagement** and automatically logs everything to a Google Sheet — so you never forget who you reached out to, what you said, or what you engaged with.

Built for people who do a lot of networking on LinkedIn but struggle to document it consistently.

---

## What It Tracks

The extension silently monitors your normal LinkedIn browsing and logs **10 types of activity**:

### Outreach
| Activity | What Gets Logged |
|----------|-----------------|
| **Connection Requests** | Person's name, profile URL, headline, your custom note |
| **Messages Sent** | Recipient name, profile URL, message content |
| **Profile Views** | Person's name, profile URL, headline, location, connection degree |

### Engagement
| Activity | What Gets Logged |
|----------|-----------------|
| **Likes / Reactions** | Reaction type (Like, Celebrate, Love, etc.), post author, post content, post URL, reaction & comment counts |
| **Comments** | Your comment text, post author, post content, post URL |
| **Posts Published** | Your post text, media type (text/image/video/poll/document), visibility setting |
| **Reposts / Shares** | Original author, post content, post URL |

### Activity
| Activity | What Gets Logged |
|----------|-----------------|
| **Searches** | Search query, search type (people/companies/content), filters used (network, geo, company) |
| **Follows / Unfollows** | Entity name, type (person/company/hashtag), URL |

---

## Google Sheet Structure

The extension auto-creates a spreadsheet called **"LinkedIn Outreach Tracker"** with **19 columns**:

| # | Column | Description |
|---|--------|-------------|
| 1 | Timestamp | ISO timestamp of the action |
| 2 | Action Type | Connection Request, Message Sent, Profile View, Reaction, Comment, Post Published, Repost/Share, Search, Follow, Unfollow |
| 3 | Person/Entity | Name of the person, company, or hashtag |
| 4 | Profile URL | Direct link to their LinkedIn profile |
| 5 | Headline/Role | Their professional headline |
| 6 | Post Content | Text content of the post you engaged with |
| 7 | Post URL | Direct link to the specific post |
| 8 | Your Note/Message/Comment | What you wrote — connection note, message, or comment |
| 9 | Reaction Type | Like, Celebrate, Support, Love, Insightful, Funny |
| 10 | Media Type | Text, Image, Video, Document, Poll, Link/Article |
| 11 | Reaction Count | Number of reactions on the post at time of engagement |
| 12 | Comment Count | Number of comments on the post at time of engagement |
| 13 | Search Query | Your search keywords |
| 14 | Search Type | people, companies, content, groups, jobs, etc. |
| 15 | Filters | Network degree, geo, company, and other filters used |
| 16 | Location | Person's location (from profile pages) |
| 17 | Connection Degree | 1st, 2nd, 3rd degree connection |
| 18 | Entity Type | Person, Company, or Hashtag (for follow actions) |
| 19 | Page URL | Full LinkedIn URL where the action occurred |

---

## Installation

### Prerequisites
- Google Chrome browser
- A Google account (for Google Sheets)
- A Google Cloud project (free tier is sufficient)

### Step 1: Clone the Repository

```bash
git clone https://github.com/anithp/linkedin-tracker.git
cd linkedin-tracker
```

### Step 2: Set Up Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **Create a new project** (or select an existing one)
3. Go to **APIs & Services > Library**
4. Search for **Google Sheets API** and click **Enable**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type
3. Fill in:
   - **App name**: `LinkedIn Activity Tracker` (or anything you like)
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click through the remaining steps (no scopes needed here)
5. Under **Test users**, add your own Google email address

### Step 4: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right corner)
3. Click **Load unpacked**
4. Select the `linkedin-tracker` folder you cloned
5. The extension will appear — **copy the Extension ID** shown on the card (a long string like `abcdefghijklmnop...`)

### Step 5: Create OAuth Credentials

1. Back in Google Cloud Console, go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client ID**
3. Fill in:
   - **Application type**: Chrome Extension
   - **Name**: `LinkedIn Activity Tracker`
   - **Item ID**: Paste the Extension ID you copied in Step 4
4. Click **Create**
5. Copy the **Client ID** (looks like `123456789-xxxxx.apps.googleusercontent.com`)

### Step 6: Update the Extension

1. Open `manifest.json` in a text editor
2. Find the line with `"client_id"` and replace the value with your Client ID:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
   ```
3. Save the file
4. Go back to `chrome://extensions/` and click the **reload** icon on the extension

### Step 7: Authorize

1. Click the extension icon in your Chrome toolbar
2. Go to LinkedIn and perform any action (e.g., view a profile)
3. You'll be prompted to sign in with Google — grant access to Google Sheets
4. Done! A spreadsheet called **"LinkedIn Outreach Tracker"** will be created in your Google Drive

---

## Usage

Once installed, **just use LinkedIn normally**. The extension works silently in the background.

### Viewing Your Data
- Click the **extension icon** to see a dashboard with activity counts
- Click **Open Google Sheet** to jump directly to your tracker spreadsheet
- Visit [Google Drive](https://drive.google.com) and search for "LinkedIn Outreach Tracker"

### Extension Popup
The popup shows a live dashboard organized into three sections:

- **Outreach** — Connection requests, messages sent, profiles viewed
- **Engagement** — Reactions, comments, posts published
- **Activity** — Searches, follows, total actions

### Buttons
| Button | Action |
|--------|--------|
| **Open Google Sheet** | Opens your tracker spreadsheet in a new tab |
| **Refresh Stats** | Reloads the dashboard counts and flushes any queued actions |
| **Reset Sheet** | Creates a new spreadsheet on next action (old one stays in Drive) |

### Offline Support
If the Google Sheets API is temporarily unavailable, actions are **queued locally** and automatically synced every 5 minutes. You'll see a "X action(s) queued for sync" message in the popup.

---

## Health Check

LinkedIn occasionally updates their DOM structure, which can break element detection. A health check script is included to diagnose issues.

### Running the Health Check

1. Open LinkedIn in Chrome
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to the **Console** tab
4. Copy and paste the contents of `health-check.js` and press Enter

The script will output a report like:

```
=== LinkedIn Tracker Health Check ===
URL: https://www.linkedin.com/in/someone/
Page type: PROFILE

PASS  profileName_topCard: found 1 element(s) — "John Doe"
PASS  profileHeadline: found 1 element(s) — "CEO at Example Corp"
FAIL  connectButton_aria: selector not found

=== Results: 4 passed, 1 failed, 6 skipped ===
```

If selectors are failing, LinkedIn has likely changed their DOM. See [Contributing](#contributing) for how to update selectors.

---

## Privacy & Safety

### What This Extension Does
- **Reads** the LinkedIn page DOM to detect your actions
- **Sends** data only to your own Google Sheet via the Google Sheets API
- **Stores** action counts and a queue of pending actions in Chrome's local storage

### What This Extension Does NOT Do
- Does **not** automate any clicks, messages, or actions on LinkedIn
- Does **not** scrape other people's profiles or data in bulk
- Does **not** inject any visible elements into LinkedIn pages
- Does **not** modify LinkedIn's DOM in any way
- Does **not** intercept or modify network requests
- Does **not** send data to any third-party server
- Does **not** expose any `web_accessible_resources` (cannot be fingerprinted by LinkedIn)

### LinkedIn Account Safety
This extension is designed to be **undetectable** by LinkedIn's anti-automation systems:

- Runs in Chrome's **isolated content script world** — invisible to LinkedIn's page JavaScript
- **Zero DOM modifications** — purely read-only
- **No web_accessible_resources** — LinkedIn probes ~3,000 known extension IDs; this extension exposes nothing to probe
- **Randomized timing** — URL checks and profile detection use jittered delays
- **No bulk data extraction** — only logs actions you personally take
- **No console logging in production** — debug mode is off by default

> **Note**: While this extension is designed to be safe, using any third-party tool with LinkedIn carries inherent risk under their [Terms of Service](https://www.linkedin.com/legal/user-agreement). Use at your own discretion.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension not tracking any activity | Make sure you're on `linkedin.com` and the extension is enabled. Refresh the LinkedIn tab after installing/reloading the extension. |
| "Actions queued for sync" won't clear | Click **Refresh Stats** to trigger a flush. If it persists, check your Google OAuth credentials. |
| Wrong person name in sheet | LinkedIn may have changed their DOM. Run the [health check](#health-check) to diagnose. |
| Auth errors / can't create sheet | Verify your OAuth Client ID in `manifest.json` matches Google Cloud Console. Make sure your email is added as a test user in the OAuth consent screen. |
| Sheet has wrong columns | Click **Reset Sheet** in the popup to create a fresh spreadsheet with the latest column structure. |
| Extension icon missing from toolbar | Click the puzzle icon in Chrome toolbar and pin the extension. |
| "Service worker registration failed" | Check `chrome://extensions/` for error details. Usually fixed by reloading the extension. |

### Debug Mode

To enable verbose logging for troubleshooting:

1. Open `content.js`
2. Change `const DEBUG = false;` to `const DEBUG = true;`
3. Reload the extension
4. Open DevTools on LinkedIn and filter console by `[PAN]`

---

## Project Structure

```
linkedin-tracker/
├── manifest.json        # Chrome Extension manifest (Manifest V3)
├── content.js           # Content script — monitors LinkedIn DOM for actions
├── background.js        # Service worker — handles Google Sheets API calls
├── popup.html           # Extension popup UI
├── popup.js             # Popup logic and stats display
├── health-check.js      # DOM selector diagnostic tool
├── icons/               # Extension icons (16, 48, 128px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── SETUP.md             # Quick setup reference
└── README.md            # This file
```

### Architecture

```
LinkedIn Tab                    Background Service Worker         Google Sheets
┌─────────────┐                ┌──────────────────────┐         ┌─────────────┐
│ content.js  │  ── message ──>│  background.js       │ ──API──>│ Your Sheet  │
│ (read-only) │                │  (Google Sheets API)  │         │ (Drive)     │
│             │                │  (offline queue)      │         │             │
└─────────────┘                └──────────────────────┘         └─────────────┘
       │                                │
       │ click/navigation               │ chrome.storage
       │ detection                      │ (stats, queue)
       ▼                                ▼
  DOM Reading Only               Extension Popup
  (no modifications)             (popup.html/js)
```

---

## Contributing

Contributions are welcome! Here's how you can help:

### Updating Selectors
LinkedIn changes their DOM structure regularly. If tracking breaks:

1. Run the health check script to identify which selectors are broken
2. Use Chrome DevTools to inspect the new DOM structure on LinkedIn
3. Update the selectors in `content.js`
4. Update `health-check.js` with the new selectors
5. Submit a PR

### Adding New Activity Types
The extension architecture makes it easy to track new actions:

1. Add a click detection pattern in the main `document.addEventListener("click", ...)` handler in `content.js`
2. Call `sendAction()` with a new `type` value
3. Add the stat counter in `background.js`
4. Update the popup if you want a new stat card

### Running Locally
1. Clone the repo
2. Follow the [Installation](#installation) steps
3. Set `DEBUG = true` in `content.js` for verbose logging
4. Make changes and reload the extension at `chrome://extensions/`

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Disclaimer

This tool is for **personal productivity** — tracking your own LinkedIn activity for your own records. It does not automate any actions, scrape data at scale, or violate LinkedIn's rate limits. However, LinkedIn's Terms of Service are broad regarding third-party tools. Use this extension at your own risk and discretion.

---

**Built with the goal of never forgetting a networking touchpoint again.**
