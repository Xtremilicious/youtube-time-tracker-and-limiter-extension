document.addEventListener("DOMContentLoaded", () => {
  // Request the initial remaining time when the popup is loaded
  chrome.runtime.sendMessage({ action: "getRemainingTime" }, function (response) {
    if (response && response.time) {
      document.getElementById("time-remaining").textContent = formatTime(response.time);
    } else {
      document.getElementById("time-remaining").textContent = "Error";
    }
  });

  // Periodically update the remaining time
  setInterval(function () {
    chrome.runtime.sendMessage({ action: "getRemainingTime" }, (response) => {
      if (response && response.time) {
        document.getElementById("time-remaining").textContent = formatTime(response.time);
      } else {
        document.getElementById("time-remaining").textContent = "Error";
      }
    });
  }, 1000);

  // Listen for real-time updates from the background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateRemainingTime") {
      document.getElementById("time-remaining").textContent = formatTime(message.time);
    }
  });

  // Handle override button click
  document.getElementById("override-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "activateOverride" });
  });

  // Function to format time as MM:SS
  function formatTime(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }
});
