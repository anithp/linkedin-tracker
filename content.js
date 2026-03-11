// Personal Activity Notes - Content Script
// Tracks: Connections, Messages, Profile Views, Comments, Likes/Reactions, Posts, Searches, Follows

(function () {
  "use strict";

  const DEBUG = false;

  let lastLoggedAction = null;
  let lastLoggedTime = 0;
  let lastProfileUrl = "";
  let lastSearchUrl = "";
  let pendingConnection = null;

  function log(...args) {
    if (DEBUG) console.log("[PAN]", ...args);
  }

  // --- Utility helpers ---

  function isDuplicate(action) {
    const now = Date.now();
    const key = `${action.type}|${action.profileUrl || action.personName || action.postAuthor || action.searchQuery}`;
    if (key === lastLoggedAction && now - lastLoggedTime < 8000) return true;
    lastLoggedAction = key;
    lastLoggedTime = now;
    return false;
  }

  function sendAction(action) {
    if (isDuplicate(action)) return;
    action.timestamp = new Date().toISOString();
    action.pageUrl = window.location.href;
    log("Action:", action.type, "-", action.personName || action.postAuthor || "");
    chrome.runtime.sendMessage({ type: "TRACK_ACTION", payload: action }, () => {
      if (chrome.runtime.lastError) log("Error:", chrome.runtime.lastError.message);
    });
  }

  // --- Name/URL extraction from profile pages ---

  function getProfileUrlFromPage() {
    const url = window.location.href;
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
    return match ? `https://www.linkedin.com/in/${match[1]}/` : null;
  }

  function getNameFromProfilePage() {
    if (!window.location.href.includes("/in/")) return null;

    const topCardName = document.querySelector(
      "[data-view-name='profile-top-card-verified-badge'] h2, " +
      "[data-view-name='profile-card'] h2, " +
      ".pv-top-card h2"
    );
    if (topCardName) {
      const text = topCardName.innerText.trim();
      if (text && text.length > 1 && text.length < 60) return text;
    }

    const h1 = document.querySelector("h1");
    if (h1) {
      const text = h1.innerText.trim();
      if (text && text.length > 1 && text.length < 60) return text;
    }

    const h2s = document.querySelectorAll("h2");
    for (const h2 of h2s) {
      const text = h2.innerText.trim();
      if (
        text && text.length > 1 && text.length < 60 &&
        !text.includes("\n") && !text.match(/^\d/) &&
        !text.toLowerCase().includes("notification") &&
        !text.toLowerCase().includes("message") &&
        !text.toLowerCase().includes("home")
      ) {
        return text;
      }
    }
    return null;
  }

  function getHeadlineFromProfilePage() {
    if (!window.location.href.includes("/in/")) return "";
    const el = document.querySelector("div.text-body-medium");
    if (el) return el.innerText.trim().substring(0, 200);
    return "";
  }

  // --- Post context extraction (for comments, likes, etc.) ---

  function getPostContext(el) {
    // Walk up to find the feed post container
    const post =
      el.closest("[data-urn]") ||
      el.closest(".feed-shared-update-v2") ||
      el.closest(".occludable-update");

    if (!post) return { postAuthor: "", postUrl: "", postText: "", postUrn: "", reactionCount: "", commentCount: "" };

    // Post URN
    const postUrn = post.getAttribute("data-urn") || "";

    // Post author name
    let postAuthor = "";
    const authorEl = post.querySelector(
      ".update-components-actor__title span[aria-hidden='true']"
    );
    if (authorEl) postAuthor = authorEl.innerText.trim();

    // Post author profile URL
    let postAuthorUrl = "";
    const authorLink = post.querySelector(
      ".update-components-actor__meta-link, a[href*='/in/']"
    );
    if (authorLink) postAuthorUrl = authorLink.href.split("?")[0];

    // Post text snippet
    let postText = "";
    const textEl = post.querySelector(".update-components-text, .feed-shared-text");
    if (textEl) postText = textEl.innerText.trim().substring(0, 300);

    // Post detail URL
    let postUrl = "";
    const detailLink = post.querySelector(
      "a[href*='/feed/update/'], .update-components-mini-update-v2__link-to-details-page"
    );
    if (detailLink) postUrl = detailLink.href.split("?")[0];

    // Social counts
    let reactionCount = "";
    const reactionsEl = post.querySelector(
      ".social-details-social-counts__reactions, [aria-label*='reaction']"
    );
    if (reactionsEl) {
      const ariaLabel = reactionsEl.getAttribute("aria-label") || "";
      reactionCount = ariaLabel.match(/\d[\d,]*/)?.[0] || reactionsEl.innerText.trim();
    }

    let commentCount = "";
    const commentsEl = post.querySelector(
      ".social-details-social-counts__comments, button[aria-label*='comment']"
    );
    if (commentsEl) {
      const ariaLabel = commentsEl.getAttribute("aria-label") || "";
      commentCount = ariaLabel.match(/\d[\d,]*/)?.[0] || commentsEl.innerText.trim();
    }

    return { postAuthor, postAuthorUrl, postUrl, postText, postUrn, reactionCount, commentCount };
  }

  // --- MAIN CLICK HANDLER ---

  document.addEventListener("click", (e) => {
    const target = e.target;

    // Debug: log ALL clicks with element info
    if (DEBUG) {
      let el = target;
      const chain = [];
      for (let i = 0; i < 5 && el; i++) {
        const tag = el.tagName?.toLowerCase() || "?";
        const cls = (el.className && typeof el.className === "string") ? el.className.substring(0, 80) : "";
        const role = el.getAttribute?.("role") || "";
        const aria = el.getAttribute?.("aria-label") || "";
        const txt = (el.innerText || "").trim().substring(0, 30);
        chain.push(`${tag}${role ? "[role=" + role + "]" : ""}${aria ? "[aria=" + aria + "]" : ""} cls="${cls}" txt="${txt}"`);
        el = el.parentElement;
      }
      console.log("[PAN] RAW CLICK chain:", chain.join(" -> "));
    }

    const clickable =
      target.closest("button") ||
      target.closest("[role='button']") ||
      target.closest("[role='menuitem']") ||
      target.closest("[role='option']") ||
      target.closest("a") ||
      target.closest("span[class*='react']") ||
      target.closest("div[class*='social-action']") ||
      target.closest("div[class*='comment']") ||
      target.closest("[class*='reactions-react']") ||
      target.closest("[data-reaction-type]");

    if (!clickable) return;

    const innerText = clickable.innerText.trim().toLowerCase();
    const ariaLabel = (clickable.getAttribute("aria-label") || "").toLowerCase();
    const ariaPressed = clickable.getAttribute("aria-pressed");

    log("Click:", innerText.substring(0, 40), "| aria:", ariaLabel.substring(0, 60));

    // ==========================================
    // 1. CONNECTION REQUESTS
    // ==========================================
    if (
      (ariaLabel.includes("invite") && ariaLabel.includes("connect")) ||
      ariaLabel.includes("connect with") ||
      (innerText === "connect" && !innerText.includes("disconnect"))
    ) {
      log("Connect button detected");
      let name = "Unknown";
      const ariaMatch = ariaLabel.match(/invite\s+(.+?)\s+to connect/i);
      if (ariaMatch) {
        name = ariaMatch[1];
      } else {
        name = getNameFromCard(clickable) || getNameFromProfilePage() || "Unknown";
      }

      const profileUrl = getProfileUrlFromCard(clickable) || getProfileUrlFromPage() || "";
      const headline = getHeadlineFromProfilePage();
      pendingConnection = { personName: name, profileUrl, headline };

      setTimeout(() => {
        const dialog = document.querySelector("[role='dialog']");
        if (!dialog || !dialog.offsetParent) {
          sendAction({
            type: "Connection Request",
            personName: name,
            profileUrl: profileUrl,
            headline: headline,
            note: "",
          });
          pendingConnection = null;
        }
      }, 2000);
      return;
    }

    // "Send without a note"
    if (innerText.includes("send without a note")) {
      if (pendingConnection) {
        sendAction({
          type: "Connection Request",
          personName: pendingConnection.personName,
          profileUrl: pendingConnection.profileUrl,
          headline: pendingConnection.headline,
          note: "",
        });
        pendingConnection = null;
      }
      return;
    }

    // "Add a note" — wait for send
    if (innerText === "add a note") return;

    // "Send" in connection dialog or message
    if (innerText === "send" || innerText === "send now") {
      const dialog = clickable.closest("[role='dialog']");
      if (dialog && pendingConnection) {
        const textarea = dialog.querySelector("textarea");
        const note = textarea ? textarea.value.trim() : "";
        sendAction({
          type: "Connection Request",
          personName: pendingConnection.personName,
          profileUrl: pendingConnection.profileUrl,
          headline: pendingConnection.headline,
          note: note,
        });
        pendingConnection = null;
        return;
      }
      if (isInMessagingContext(clickable)) {
        handleMessageSend();
        return;
      }
    }

    // ==========================================
    // 2. MESSAGES
    // ==========================================
    if (ariaLabel.includes("send") && isInMessagingContext(clickable)) {
      handleMessageSend();
      return;
    }

    // ==========================================
    // 3. LIKES / REACTIONS
    // ==========================================
    if (
      ariaLabel.includes("like") ||
      ariaLabel.includes("celebrate") ||
      ariaLabel.includes("support") ||
      ariaLabel.includes("love") ||
      ariaLabel.includes("insightful") ||
      ariaLabel.includes("funny")
    ) {
      // Only track when liking (not un-liking)
      // aria-pressed="false" means it's about to become true (liking)
      if (ariaPressed === "true") return; // Already liked, this is an unlike

      const reactionType = detectReactionType(ariaLabel, innerText);
      const context = getPostContext(clickable);

      if (context.postAuthor || context.postText) {
        sendAction({
          type: "Reaction",
          reactionType: reactionType,
          personName: context.postAuthor,
          profileUrl: context.postAuthorUrl || "",
          postUrl: context.postUrl,
          postText: context.postText,
          postUrn: context.postUrn,
          reactionCount: context.reactionCount,
          commentCount: context.commentCount,
          note: "",
          headline: "",
        });
      }
      return;
    }

    // Reaction menu items (Celebrate, Love, etc.)
    if (clickable.matches("[role='menuitem']")) {
      const reactionLabels = ["celebrate", "support", "love", "insightful", "funny", "like"];
      const matchedReaction = reactionLabels.find(r => ariaLabel.includes(r) || innerText.includes(r));
      if (matchedReaction) {
        const context = getPostContext(clickable);
        if (context.postAuthor || context.postText) {
          sendAction({
            type: "Reaction",
            reactionType: matchedReaction.charAt(0).toUpperCase() + matchedReaction.slice(1),
            personName: context.postAuthor,
            profileUrl: context.postAuthorUrl || "",
            postUrl: context.postUrl,
            postText: context.postText,
            postUrn: context.postUrn,
            reactionCount: context.reactionCount,
            commentCount: context.commentCount,
            note: "",
            headline: "",
          });
        }
        return;
      }
    }

    // ==========================================
    // 4. COMMENTS — "Post" or "Reply" button in comment section
    // ==========================================
    if (
      (innerText === "post" || innerText === "reply") &&
      !clickable.closest("[role='dialog']") // Exclude share dialog "Post"
    ) {
      // Check if this is in a comment context (not the share box)
      const commentForm = clickable.closest(
        ".comments-comment-texteditor, [class*='comment'], .comments-comment-box"
      );
      if (commentForm) {
        const editable = commentForm.querySelector("[contenteditable='true'], textarea");
        const commentText = editable ? (editable.value || editable.innerText || "").trim() : "";
        const context = getPostContext(clickable);

        if (commentText) {
          sendAction({
            type: "Comment",
            personName: context.postAuthor,
            profileUrl: context.postAuthorUrl || "",
            postUrl: context.postUrl,
            postText: context.postText.substring(0, 150),
            postUrn: context.postUrn,
            reactionCount: context.reactionCount,
            commentCount: context.commentCount,
            note: commentText.substring(0, 500),
            headline: "",
          });
        }
        return;
      }
    }

    // ==========================================
    // 5. POSTS PUBLISHED — "Post" in share dialog
    // ==========================================
    if (innerText === "post" || innerText === "post") {
      const shareDialog = clickable.closest("[role='dialog']");
      if (shareDialog) {
        const editable = shareDialog.querySelector("[contenteditable='true']");
        const postText = editable ? editable.innerText.trim() : "";

        // Detect media type
        let mediaType = "Text";
        if (shareDialog.querySelector("img[class*='image'], [class*='image-upload']")) mediaType = "Image";
        if (shareDialog.querySelector("video, [class*='video']")) mediaType = "Video";
        if (shareDialog.querySelector("[class*='document'], [class*='pdf']")) mediaType = "Document";
        if (shareDialog.querySelector("[class*='poll']")) mediaType = "Poll";
        if (shareDialog.querySelector("[class*='article'], [class*='link-preview']")) mediaType = "Link/Article";

        // Detect visibility
        let visibility = "";
        const visibilityEl = shareDialog.querySelector(
          "[class*='share-creation-state__visibility'] button, [class*='visibility'] span"
        );
        if (visibilityEl) visibility = visibilityEl.innerText.trim();

        if (postText) {
          sendAction({
            type: "Post Published",
            personName: "You",
            profileUrl: "",
            postText: postText.substring(0, 500),
            mediaType: mediaType,
            visibility: visibility,
            note: "",
            headline: "",
          });
        }
        return;
      }
    }

    // ==========================================
    // 6. FOLLOW / UNFOLLOW
    // ==========================================
    if (
      innerText === "follow" ||
      innerText === "following" ||
      ariaLabel.includes("follow")
    ) {
      const isUnfollow = innerText === "following" || ariaLabel.includes("unfollow");

      // Determine entity type from URL
      let entityType = "Person";
      let entityName = "";
      let entityUrl = window.location.href;

      if (window.location.href.includes("/company/")) {
        entityType = "Company";
        const h1 = document.querySelector("h1");
        entityName = h1 ? h1.innerText.trim() : "";
      } else if (window.location.href.includes("/in/")) {
        entityType = "Person";
        entityName = getNameFromProfilePage() || "";
      } else if (window.location.href.includes("/hashtag/")) {
        entityType = "Hashtag";
        const match = window.location.href.match(/hashtag\/([^/?]+)/);
        entityName = match ? `#${match[1]}` : "";
      } else {
        entityName = getNameFromCard(clickable) || "";
      }

      if (entityName) {
        sendAction({
          type: isUnfollow ? "Unfollow" : "Follow",
          personName: entityName,
          entityType: entityType,
          profileUrl: entityUrl.split("?")[0],
          note: "",
          headline: "",
        });
      }
      return;
    }

    // ==========================================
    // 7. REPOST / SHARE
    // ==========================================
    if (innerText === "repost" || innerText === "share" || ariaLabel.includes("repost")) {
      const context = getPostContext(clickable);
      if (context.postAuthor) {
        sendAction({
          type: "Repost/Share",
          personName: context.postAuthor,
          profileUrl: context.postAuthorUrl || "",
          postUrl: context.postUrl,
          postText: context.postText.substring(0, 300),
          postUrn: context.postUrn,
          note: "",
          headline: "",
        });
      }
    }
  }, true);

  // --- Enter key for messages ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const active = document.activeElement;
      if (!active) return;
      if (
        active.getAttribute("contenteditable") === "true" ||
        active.tagName === "TEXTAREA"
      ) {
        if (isInMessagingContext(active)) {
          handleMessageSend();
        }
      }
    }
  }, true);

  // --- Helpers ---

  function detectReactionType(ariaLabel, innerText) {
    const types = ["celebrate", "support", "love", "insightful", "funny", "like"];
    for (const t of types) {
      if (ariaLabel.includes(t) || innerText.includes(t)) {
        return t.charAt(0).toUpperCase() + t.slice(1);
      }
    }
    return "Like";
  }

  function isInMessagingContext(el) {
    if (window.location.href.includes("/messaging/")) return true;
    return !!el.closest("[class*='msg-'], [class*='messaging'], [class*='message'], [role='dialog']");
  }

  function handleMessageSend() {
    let messageText = "";
    const editables = document.querySelectorAll("[contenteditable='true'], textarea");
    for (const el of editables) {
      if (isInMessagingContext(el)) {
        messageText = (el.value || el.innerText || "").trim();
        if (messageText) break;
      }
    }

    let recipientName = "";
    let profileUrl = "";

    const msgHeaders = document.querySelectorAll(
      "[class*='msg'] h2, [class*='messaging'] h2, [class*='conversation'] h2"
    );
    for (const h of msgHeaders) {
      const text = h.innerText.trim();
      if (text && text.length > 1 && text.length < 80) { recipientName = text; break; }
    }

    if (!recipientName) {
      const links = document.querySelectorAll("[class*='msg'] a[href*='/in/']");
      for (const link of links) {
        const text = link.innerText.trim();
        if (text && text.length > 1 && text.length < 80) {
          recipientName = text;
          profileUrl = link.href.split("?")[0];
          break;
        }
      }
    }

    if (!recipientName) {
      const bubbleTitle = document.querySelector("[class*='bubble-header'] span, [class*='overlay'] h2 span");
      if (bubbleTitle) recipientName = bubbleTitle.innerText.trim();
    }

    sendAction({
      type: "Message Sent",
      personName: recipientName || "Unknown",
      profileUrl: profileUrl,
      headline: "",
      note: messageText.substring(0, 500),
    });
  }

  // --- Profile View Detection ---

  function checkProfileView() {
    const profileUrl = getProfileUrlFromPage();
    if (!profileUrl || profileUrl === lastProfileUrl) return;
    lastProfileUrl = profileUrl;

    const delay = 2500 + Math.random() * 1500;
    setTimeout(() => {
      const name = getNameFromProfilePage();
      const headline = getHeadlineFromProfilePage();

      // Also grab extra profile data
      let location = "";
      const locEl = document.querySelector(".text-body-small.inline.t-black--light");
      if (locEl) location = locEl.innerText.trim();

      let connectionDegree = "";
      const degreeEl = document.querySelector(
        ".dist-value, span.distance-badge, [class*='distance']"
      );
      if (degreeEl) connectionDegree = degreeEl.innerText.trim();

      if (name) {
        sendAction({
          type: "Profile View",
          personName: name,
          profileUrl: profileUrl,
          headline: headline,
          location: location,
          connectionDegree: connectionDegree,
          note: "",
        });
      }
    }, delay);
  }

  // --- Search Activity Detection ---

  function checkSearchActivity() {
    const url = window.location.href;
    if (!url.includes("/search/results/")) return;
    if (url === lastSearchUrl) return;
    lastSearchUrl = url;

    try {
      const urlObj = new URL(url);
      const keywords = urlObj.searchParams.get("keywords") || "";
      const searchType = url.match(/\/search\/results\/([^/?]+)/)?.[1] || "all";
      const network = urlObj.searchParams.get("network") || "";
      const geoUrn = urlObj.searchParams.get("geoUrn") || "";
      const currentCompany = urlObj.searchParams.get("currentCompany") || "";
      const origin = urlObj.searchParams.get("origin") || "";

      // Count results on page
      const results = document.querySelectorAll(
        ".reusable-search__result-container, .entity-result"
      );

      const filters = [];
      if (network) filters.push(`Network: ${network}`);
      if (geoUrn) filters.push(`Geo: ${geoUrn}`);
      if (currentCompany) filters.push(`Company: ${currentCompany}`);

      sendAction({
        type: "Search",
        searchQuery: keywords,
        searchType: searchType,
        filters: filters.join("; "),
        resultCount: String(results.length),
        personName: "",
        profileUrl: "",
        headline: "",
        note: "",
      });
    } catch (err) {
      log("Search parse error:", err);
    }
  }

  // --- SPA Navigation Detection ---

  let currentUrl = window.location.href;

  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      checkProfileView();
      checkSearchActivity();
    }
  });

  function scheduleUrlCheck() {
    const interval = 2000 + Math.random() * 1000;
    setTimeout(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        checkProfileView();
        checkSearchActivity();
      }
      scheduleUrlCheck();
    }, interval);
  }

  window.addEventListener("popstate", () => {
    setTimeout(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        checkProfileView();
        checkSearchActivity();
      }
    }, 1000);
  });

  // --- Card helpers ---

  function getNameFromCard(el) {
    const card =
      el.closest("li") ||
      el.closest("[class*='entity']") ||
      el.closest("[class*='card']") ||
      el.closest("[class*='result']");
    if (!card) return null;

    const actorName = card.querySelector(
      ".update-components-actor__title span[aria-hidden='true'], span[aria-hidden='true']"
    );
    if (actorName) {
      const text = actorName.innerText.trim();
      if (text && text.length > 1 && text.length < 80) return text;
    }

    const profileLink = card.querySelector("a[href*='/in/'] span[aria-hidden='true']");
    if (profileLink) return profileLink.innerText.trim();

    return null;
  }

  function getProfileUrlFromCard(el) {
    const card =
      el.closest("li") ||
      el.closest("[class*='entity']") ||
      el.closest("[class*='card']") ||
      el.closest("[class*='result']");
    if (!card) return null;

    const link = card.querySelector("a[href*='/in/']");
    return link ? link.href.split("?")[0] : null;
  }

  // --- Initialize ---

  function init() {
    if (document.body) {
      urlObserver.observe(document.body, { childList: true, subtree: true });
    }
    scheduleUrlCheck();
    checkProfileView();
    checkSearchActivity();
    log("Loaded. URL:", window.location.href);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
