document.addEventListener("DOMContentLoaded", () => {
  // Request the initial remaining time when the popup is loaded
  chrome.runtime.sendMessage(
    { action: "getRemainingTime" },
    function (response) {
      if (response && response.time) {
        document.getElementById("time-remaining").textContent = formatTime(
          response.time
        );
      } else {
        document.getElementById("time-remaining").textContent = "00:00";
      }
    }
  );

  // Periodically update the remaining time
  setInterval(function () {
    chrome.runtime.sendMessage({ action: "getRemainingTime" }, (response) => {
      if (response && response.time) {
        document.getElementById("time-remaining").textContent = formatTime(
          response.time
        );
      } else {
        document.getElementById("time-remaining").textContent = "00:00";
      }
    });
  }, 1000);

  // Handle override button click
  document.getElementById("override-btn").addEventListener("click", () => {
    console.log("Override button clicked");
    chrome.storage.local.get(["overrideLimit"], (data) => {
      chrome.runtime.sendMessage({
        action: "activateOverride",
        overrideLimit: data.overrideLimit,
      });
      changeOverrideBtn(true, data.overrideLimit);
    });
  });

  function changeOverrideBtn(isActive, overrideLimit) {
    const overrideBtn = document.getElementById("override-btn");
    if (isActive) {
      overrideBtn.disabled = true;
      overrideBtn.innerHTML = `<p>Override active <br>(~${overrideLimit} minutes)</p>`;
      overrideBtn.style.color = "#ff0000";
    } else {
      overrideBtn.disabled = false;
      overrideBtn.innerHTML = "Override";
      overrideBtn.style.color = "#ffffff";
    }
  }

  // Function to format time as HH:MM:SS or MM:SS
  function formatTime(timeInSeconds) {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes < 10 ? "0" : ""}${minutes}:${
        seconds < 10 ? "0" : ""
      }${seconds}`;
    }
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  // Load the override state from storage when the popup is loaded
  chrome.storage.local.get(["isOverrideActive", "overrideLimit"], (data) => {
    console.log("Override state loaded from storage:", data);
    changeOverrideBtn(data.isOverrideActive, data.overrideLimit);
  });
});
