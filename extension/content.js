function handleVisibilityChange() {
  const isVisible =
    document.visibilityState === "visible" && document.hidden !== true;

  console.log("handleVisibilityChange:", isVisible);

  chrome.runtime.sendMessage({ action: "updateVisibility", isVisible }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(`Error sending visibility update (${isVisible}): ${chrome.runtime.lastError.message}`);
    } else {
      // Optional: handle successful response if needed
      console.log("Visibility update sent successfully.");
    }
  });
}

// Listen for visibility changes
document.addEventListener("visibilitychange", handleVisibilityChange);

// Notify the background script of the initial visibility state
const initialIsVisible = document.visibilityState === "visible" && document.hidden !== true;
chrome.runtime.sendMessage({ action: "updateVisibility", isVisible: initialIsVisible }, (response) => {
  if (chrome.runtime.lastError) {
    console.warn(`Error sending initial visibility state (${initialIsVisible}): ${chrome.runtime.lastError.message}`);
  } else {
    console.log("Initial visibility state sent successfully.");
  }
});


function formatTime(timeInSeconds) {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
