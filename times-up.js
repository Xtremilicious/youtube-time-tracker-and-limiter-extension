document.getElementById("override-btn").addEventListener("click", () => {
  console.log("Override button clicked on times-up page");

  chrome.storage.local.get(["overrideLimit"], (data) => {
    chrome.runtime.sendMessage({
      action: "activateOverride",
      overrideLimit: data.overrideLimit,
    });

    // Get the original URL from storage or query parameters
    chrome.storage.local.get("originalUrl", (data) => {
      const originalUrl = data.originalUrl || "https://www.youtube.com"; // Default to youtube if not found

      // Redirect to the original URL
      window.location.href = originalUrl;
    });
  });
});
