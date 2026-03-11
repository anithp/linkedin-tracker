# LinkedIn Outreach Tracker - Setup Guide

## Step 1: Create Google Cloud Project & Enable Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing one)
3. Go to **APIs & Services > Library**
4. Search for **Google Sheets API** and click **Enable**

## Step 2: Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - Choose **External** user type
   - Fill in app name: "LinkedIn Outreach Tracker"
   - Add your email as test user
4. Back in Credentials, create the OAuth Client ID:
   - Application type: **Chrome Extension**
   - Name: "LinkedIn Outreach Tracker"
   - Extension ID: (you'll get this after loading the extension, see Step 3)

## Step 3: Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked** and select this project folder
4. Copy the **Extension ID** shown under the extension card
5. Go back to Google Cloud Console and paste this ID into the OAuth credential

## Step 4: Update the Extension

1. Open `manifest.json`
2. Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual OAuth Client ID
3. Go back to `chrome://extensions/` and click the **reload** button on the extension

## Step 5: Authorize

1. Click the extension icon in Chrome toolbar
2. It will prompt you to sign in with Google
3. Grant access to Google Sheets
4. Done! The extension will auto-create a "LinkedIn Outreach Tracker" spreadsheet

## How It Works

The extension monitors your LinkedIn tab and automatically logs:

| Action | Trigger |
|--------|---------|
| **Connection Request** | When you click "Connect" and send the request |
| **Message Sent** | When you send a message in LinkedIn messaging |
| **Profile View** | When you visit someone's profile page |

Each action creates a row in your Google Sheet with:
- Timestamp
- Action Type
- Person's Name
- Profile URL
- Headline
- Note/Message content
- Page URL

## Sheet Structure

The extension auto-creates a spreadsheet called **"LinkedIn Outreach Tracker"** with a sheet named **"Outreach Log"**.

## Troubleshooting

- **Extension not tracking**: Make sure you're on `linkedin.com` and the extension is enabled
- **Auth errors**: Check that your OAuth client ID is correct and the extension ID matches
- **Queued actions**: If you see "actions queued for sync" in the popup, click Refresh - they'll sync when auth is restored
- **Reset**: To start fresh, right-click the extension > "Clear storage" from the DevTools console
