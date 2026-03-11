// Personal Activity Notes - Background Service Worker

const SHEET_HEADERS = [
  "Timestamp",
  "Action Type",
  "Person/Entity",
  "Profile URL",
  "Headline/Role",
  "Post Content",
  "Post URL",
  "Your Note/Message/Comment",
  "Reaction Type",
  "Media Type",
  "Reaction Count",
  "Comment Count",
  "Search Query",
  "Search Type",
  "Filters",
  "Location",
  "Connection Degree",
  "Entity Type",
  "Page URL",
];

// --- Google Sheets Integration ---

async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

async function getOrCreateSpreadsheet(token) {
  const result = await chrome.storage.local.get("spreadsheetId");
  if (result.spreadsheetId) {
    try {
      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${result.spreadsheetId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) return result.spreadsheetId;
    } catch (_) {}
  }

  const resp = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: "LinkedIn Outreach Tracker" },
      sheets: [
        {
          properties: { title: "Activity Log", gridProperties: { frozenRowCount: 1 } },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: SHEET_HEADERS.map((h) => ({
                    userEnteredValue: { stringValue: h },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      horizontalAlignment: "CENTER",
                    },
                  })),
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to create spreadsheet: ${err}`);
  }

  const data = await resp.json();
  const spreadsheetId = data.spreadsheetId;
  await chrome.storage.local.set({ spreadsheetId });
  return spreadsheetId;
}

function buildRow(action) {
  return [
    action.timestamp || new Date().toISOString(),
    action.type || "",
    action.personName || "",
    action.profileUrl || "",
    action.headline || "",
    action.postText || "",
    action.postUrl || "",
    action.note || "",
    action.reactionType || "",
    action.mediaType || "",
    action.reactionCount || "",
    action.commentCount || "",
    action.searchQuery || "",
    action.searchType || "",
    action.filters || "",
    action.location || "",
    action.connectionDegree || "",
    action.entityType || "",
    action.pageUrl || "",
  ];
}

async function appendToSheet(action) {
  try {
    const token = await getAuthToken();
    const spreadsheetId = await getOrCreateSpreadsheet(token);
    const row = buildRow(action);

    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Activity%20Log!A:S:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [row] }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Failed to append: ${err}`);
    }

    // Update local stats
    const stats = (await chrome.storage.local.get("stats")).stats || {
      totalActions: 0,
      connections: 0,
      messages: 0,
      profileViews: 0,
      comments: 0,
      reactions: 0,
      posts: 0,
      searches: 0,
      follows: 0,
    };
    stats.totalActions++;
    if (action.type === "Connection Request") stats.connections++;
    if (action.type === "Message Sent") stats.messages++;
    if (action.type === "Profile View") stats.profileViews++;
    if (action.type === "Comment") stats.comments++;
    if (action.type === "Reaction") stats.reactions++;
    if (action.type === "Post Published") stats.posts++;
    if (action.type === "Repost/Share") stats.posts++;
    if (action.type === "Search") stats.searches++;
    if (action.type === "Follow") stats.follows++;
    stats.lastSync = new Date().toISOString();
    await chrome.storage.local.set({ stats });

    return true;
  } catch (err) {
    await queueAction(action);
    return false;
  }
}

// --- Offline Queue ---

async function queueAction(action) {
  const result = await chrome.storage.local.get("pendingQueue");
  const queue = result.pendingQueue || [];
  queue.push(action);
  await chrome.storage.local.set({ pendingQueue: queue });
}

async function flushQueue() {
  const result = await chrome.storage.local.get("pendingQueue");
  const queue = result.pendingQueue || [];
  if (queue.length === 0) return;

  const remaining = [];
  for (const action of queue) {
    try {
      const token = await getAuthToken();
      const spreadsheetId = await getOrCreateSpreadsheet(token);
      const row = buildRow(action);

      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Activity%20Log!A:S:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: [row] }),
        }
      );
      if (!resp.ok) remaining.push(action);
    } catch (_) {
      remaining.push(action);
    }
  }
  await chrome.storage.local.set({ pendingQueue: remaining });
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TRACK_ACTION") {
    appendToSheet(message.payload).then((success) => sendResponse({ success }));
    return true;
  }
  if (message.type === "GET_STATS") {
    chrome.storage.local.get("stats", (result) => sendResponse(result.stats || {}));
    return true;
  }
  if (message.type === "GET_SHEET_URL") {
    chrome.storage.local.get("spreadsheetId", (result) => {
      sendResponse({
        url: result.spreadsheetId
          ? `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}`
          : null,
      });
    });
    return true;
  }
  if (message.type === "FLUSH_QUEUE") {
    flushQueue().then(() => sendResponse({ done: true }));
    return true;
  }
});

chrome.alarms.create("flushQueue", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flushQueue") flushQueue();
});
