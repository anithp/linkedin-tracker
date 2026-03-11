document.addEventListener("DOMContentLoaded", () => {
  function loadStats() {
    chrome.runtime.sendMessage({ type: "GET_STATS" }, (stats) => {
      if (chrome.runtime.lastError) return;
      if (!stats) stats = {};
      document.getElementById("connections").textContent = stats.connections || 0;
      document.getElementById("messages").textContent = stats.messages || 0;
      document.getElementById("profileViews").textContent = stats.profileViews || 0;
      document.getElementById("reactions").textContent = stats.reactions || 0;
      document.getElementById("comments").textContent = stats.comments || 0;
      document.getElementById("posts").textContent = stats.posts || 0;
      document.getElementById("searches").textContent = stats.searches || 0;
      document.getElementById("follows").textContent = stats.follows || 0;
      document.getElementById("totalActions").textContent = stats.totalActions || 0;

      if (stats.lastSync) {
        const ago = getTimeAgo(new Date(stats.lastSync));
        document.getElementById("statusText").textContent = "Last logged " + ago;
        document.getElementById("statusDot").className = "dot";
      } else {
        document.getElementById("statusText").textContent = "Waiting for activity...";
        document.getElementById("statusDot").className = "dot offline";
      }
    });

    chrome.runtime.sendMessage({ type: "GET_SHEET_URL" }, (resp) => {
      if (chrome.runtime.lastError) return;
      var link = document.getElementById("openSheet");
      if (resp && resp.url) {
        link.href = resp.url;
        link.style.opacity = "1";
        link.style.pointerEvents = "auto";
        link.textContent = "Open Google Sheet";
      } else {
        link.href = "#";
        link.style.opacity = "0.5";
        link.style.pointerEvents = "none";
        link.textContent = "Sheet created on first log";
      }
    });

    chrome.storage.local.get("pendingQueue", (result) => {
      var queue = result.pendingQueue || [];
      var info = document.getElementById("queueInfo");
      if (queue.length > 0) {
        info.style.display = "block";
        info.textContent = queue.length + " action(s) queued for sync";
      } else {
        info.style.display = "none";
      }
    });
  }

  function getTimeAgo(date) {
    var seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    return Math.floor(seconds / 86400) + "d ago";
  }

  // Refresh button
  document.getElementById("refreshStats").addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    loadStats();
    // Also flush queued actions
    chrome.runtime.sendMessage({ type: "FLUSH_QUEUE" }, function () {
      setTimeout(loadStats, 2000);
    });
  });

  // Open sheet button
  document.getElementById("openSheet").addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var href = this.href;
    if (href && href !== "#" && !href.endsWith("#")) {
      chrome.tabs.create({ url: href });
    }
  });

  // Reset sheet button
  document.getElementById("resetSheet").addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("This will create a new spreadsheet on next action. Old sheet stays in Drive. Continue?")) {
      chrome.storage.local.remove(["spreadsheetId", "stats", "pendingQueue"], function () {
        loadStats();
        document.getElementById("statusText").textContent = "Reset! New sheet on next action.";
      });
    }
  });

  // Initial load
  loadStats();
});
