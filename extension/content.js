function handleVisibilityChange() {
  const isVisible =
    document.visibilityState === "visible" && document.hidden !== true;

  console.log("handleVisibilityChange:", isVisible);

  chrome.runtime.sendMessage({
    action: "updateVisibility",
    isVisible,
  });
}

// Listen for visibility changes
document.addEventListener("visibilitychange", handleVisibilityChange);

// Notify the background script of the initial visibility state
chrome.runtime.sendMessage({
  action: "updateVisibility",
  isVisible: document.visibilityState === "visible" && document.hidden !== true,
});


function formatTime(timeInSeconds) {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
