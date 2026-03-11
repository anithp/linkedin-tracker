// LinkedIn DOM Structure Health Check
// Run this in the browser console on LinkedIn to verify selectors still work
// Or trigger from the extension popup to get a diagnostic report

const SELECTORS_TO_CHECK = {
  // Profile page selectors
  profileName_topCard: "[data-view-name='profile-top-card-verified-badge'] h2",
  profileName_h1: "h1",
  profileHeadline: "div.text-body-medium",

  // Feed selectors
  feedActorName: ".update-components-actor__title span[aria-hidden='true']",
  feedActorName_alt: "span[aria-hidden='true']",

  // Connect button selectors
  connectButton_aria: "[aria-label*='Invite'][aria-label*='connect']",
  connectButton_text: "button, [role='button'], [role='menuitem']",

  // Dialog selectors
  dialog: "[role='dialog']",
  dialogTextarea: "[role='dialog'] textarea",
  dialogSendButton: "[role='dialog'] button",

  // Messaging selectors
  msgContentEditable: "[contenteditable='true']",
  msgTextarea: "textarea",
  msgHeader: "[class*='msg'] h2",
  msgProfileLink: "[class*='msg'] a[href*='/in/']",
};

function runHealthCheck() {
  const results = {};
  const isProfilePage = window.location.href.includes("/in/");
  const isMessagingPage = window.location.href.includes("/messaging/");
  const isFeedPage =
    window.location.href === "https://www.linkedin.com/feed/" ||
    window.location.href === "https://www.linkedin.com/";

  console.log("=== LinkedIn Tracker Health Check ===");
  console.log("URL:", window.location.href);
  console.log("Page type:", isProfilePage ? "PROFILE" : isMessagingPage ? "MESSAGING" : isFeedPage ? "FEED" : "OTHER");
  console.log("");

  let passing = 0;
  let failing = 0;
  let skipped = 0;

  for (const [name, selector] of Object.entries(SELECTORS_TO_CHECK)) {
    // Skip irrelevant selectors based on page type
    const isProfileSelector = name.startsWith("profile");
    const isFeedSelector = name.startsWith("feed");
    const isMsgSelector = name.startsWith("msg");

    if (isProfileSelector && !isProfilePage) { skipped++; continue; }
    if (isFeedSelector && !isFeedPage) { skipped++; continue; }
    if (isMsgSelector && !isMessagingPage) { skipped++; continue; }

    try {
      const elements = document.querySelectorAll(selector);
      const found = elements.length > 0;
      const sample = found ? elements[0].innerText.trim().substring(0, 50) : "N/A";

      results[name] = {
        found,
        count: elements.length,
        sample,
      };

      if (found) {
        console.log(`PASS  ${name}: found ${elements.length} element(s) — "${sample}"`);
        passing++;
      } else {
        console.warn(`FAIL  ${name}: selector not found — "${selector}"`);
        failing++;
      }
    } catch (err) {
      console.error(`ERROR ${name}: ${err.message}`);
      results[name] = { found: false, error: err.message };
      failing++;
    }
  }

  console.log("");
  console.log(`=== Results: ${passing} passed, ${failing} failed, ${skipped} skipped ===`);

  if (failing > 0) {
    console.warn(
      "Some selectors are broken! LinkedIn may have updated their DOM structure. " +
      "The extension may not detect all actions correctly."
    );
    console.log("");
    console.log("To debug, inspect the page elements and update the selectors in content.js");
    console.log("Useful commands:");
    console.log('  document.querySelectorAll("h1, h2, h3").forEach(e => console.log(e.tagName, e.innerText.trim().substring(0,50)))');
    console.log('  document.querySelectorAll("[aria-label*=connect]").forEach(e => console.log(e.tagName, e.getAttribute("aria-label")))');
  }

  return { passing, failing, skipped, results };
}

// Export for use in extension popup
if (typeof window !== "undefined") {
  window.__linkedinTrackerHealthCheck = runHealthCheck;
}

// Auto-run if pasted in console
if (typeof chrome === "undefined" || !chrome.runtime?.id) {
  runHealthCheck();
}
