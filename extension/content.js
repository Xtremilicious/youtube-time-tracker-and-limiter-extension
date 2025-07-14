function handleVisibilityChange() {
  const isVisible =
    document.visibilityState === "visible" && document.hidden !== true;

  console.log("document.visibilityState:", document.visibilityState);
  console.log("handleVisibilityChange:", isVisible);

  chrome.runtime.sendMessage(
    { action: "updateVisibility", isVisible },
    (response) => {
      if (chrome.runtime.lastError) {
        console.warn(
          `Error sending visibility update (${isVisible}): ${chrome.runtime.lastError.message}`
        );
      } else {
        console.log("Visibility update sent successfully.");
      }
    }
  );
}

// Listen for visibility changes from the document
document.addEventListener("visibilitychange", handleVisibilityChange);

// Listen for visibility state updates from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "visibilityStateUpdate") {
    console.log("Received visibility state update:", message);
    // You can use message.isVisible and message.isPaused here to update UI if needed
  }
});

// Notify the background script of the initial visibility state
const initialIsVisible =
  document.visibilityState === "visible" && document.hidden !== true;
chrome.runtime.sendMessage(
  { action: "updateVisibility", isVisible: initialIsVisible },
  (response) => {
    if (chrome.runtime.lastError) {
      console.warn(
        `Error sending initial visibility state (${initialIsVisible}): ${chrome.runtime.lastError.message}`
      );
    } else {
      console.log("Initial visibility state sent successfully.");
    }
  }
);

function formatTime(timeInSeconds) {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
