document.addEventListener("DOMContentLoaded", () => {
  // Request the initial remaining time when the popup is loaded
  chrome.runtime.sendMessage(
    { action: "getRemainingTime" },
    function (response) {
      if (response && response.time) {
        document
          .getElementById("time-remaining")
          .querySelector(".time").textContent = formatTime(response.time);
      } else {
        document
          .getElementById("time-remaining")
          .querySelector(".time").textContent = "00:00";
      }
    }
  );

  // Periodically update the remaining time
  setInterval(function () {
    chrome.runtime.sendMessage({ action: "getRemainingTime" }, (response) => {
      if (response && response.time) {
        document
          .getElementById("time-remaining")
          .querySelector(".time").textContent = formatTime(response.time);
      } else {
        document
          .getElementById("time-remaining")
          .querySelector(".time").textContent = "00:00";
      }
    });
  }, 1000);

  //Tracking Stuff
  chrome.storage.local.get(["timeTracking"], (data) => {
    const timeTracking = data.timeTracking || {};
    const totalTimeToday = timeTracking.today;
    document
      .getElementById("today-total-time")
      .querySelector(".total-time").textContent = formatTime(totalTimeToday);
  });

  setInterval(function () {
    chrome.storage.local.get(["timeTracking"], (data) => {
      const timeTracking = data.timeTracking || {};
      const totalTimeToday = timeTracking.today;
      document
        .getElementById("today-total-time")
        .querySelector(".total-time").textContent = formatTime(totalTimeToday);
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

  // Add click listener to close the popup
  document.getElementById("close-btn").addEventListener("click", () => {
    window.close(); // This closes the popup window
  });

  document.getElementById("settings-btn").addEventListener("click", () => {
    const settingsPageURL = chrome.runtime.getURL("options.html");
    window.open(settingsPageURL, "_blank");
  });

  function changeOverrideBtn(isActive, overrideLimit) {
    const overrideBtn = document.getElementById("override-btn");
    const timeRemainingElement = document.getElementById("time-remaining");
    const timeElement = timeRemainingElement.querySelector(".time");
    const fancyTextElement = timeRemainingElement.querySelector(".fancy-text");
    if (isActive) {
      overrideBtn.disabled = true;
      timeElement.classList.add("blinking");
      timeRemainingElement.classList.add("override");
      fancyTextElement.textContent = `Overridden for ~${overrideLimit} minutes`;
    } else {
      overrideBtn.disabled = false;
      timeElement.classList.remove("blinking");
      timeRemainingElement.classList.remove("override");
    }
  }

  // Function to format time as HH:MM:SS
  function formatTime(timeInSeconds) {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;

    return `${hours < 10 ? "0" : ""}${hours}:${
      minutes < 10 ? "0" : ""
    }${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  // Load the override state from storage when the popup is loaded
  chrome.storage.local.get(["isOverrideActive", "overrideLimit"], (data) => {
    console.log("Override state loaded from storage:", data);
    changeOverrideBtn(data.isOverrideActive, data.overrideLimit);
  });

  // Function to update the status dot based on isPaused state
  function updateStatusDot(isPaused = true, isOverrideActive = false) {
    chrome.storage.local.get(["overrideLimit"], (data) => {
      const statusDot = document.getElementById("status-dot");

      // Update the status dot color
      if (isPaused || isOverrideActive) {
        statusDot.style.backgroundColor = "#ff0033"; // Red when paused or override active
        statusDot.style.boxShadow = "0 0 4px #ff0033"; // Optional: add a glow effect
      } else {
        statusDot.style.backgroundColor = "#80c894"; // Green when running and override is inactive
        statusDot.style.boxShadow = "0 0 4px #80c894"; // Optional: add a glow effect
      }

      // Handle the override button state based on isOverrideActive
      const overrideBtn = document.getElementById("override-btn");
      const timeRemainingElement = document.getElementById("time-remaining");
      const timeElement = timeRemainingElement.querySelector(".time");
      const fancyTextElement =
        timeRemainingElement.querySelector(".fancy-text");

      if (isOverrideActive) {
        // If override is active, disable the override button
        overrideBtn.disabled = true;
        timeElement.classList.add("blinking");
        timeRemainingElement.classList.add("override");
        fancyTextElement.textContent = `Overridden for ~${data.overrideLimit} minutes`;
      } else {
        // If override is inactive, enable the override button and reset UI
        overrideBtn.disabled = false;
        timeElement.classList.remove("blinking");
        timeRemainingElement.classList.remove("override");
      }
    });
  }

  // Listen for changes in chrome storage
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.isPaused) {
        updateStatusDot(
          changes.isPaused.newValue,
          changes.isOverrideActive ? changes.isOverrideActive.newValue : false
        );
      }

      if (changes.isOverrideActive) {
        updateStatusDot(
          changes.isPaused ? changes.isPaused.newValue : false,
          changes.isOverrideActive.newValue
        );
      }
    }
  });

  // Handle override button click to toggle pause state and update the dot
  document.getElementById("override-btn").addEventListener("click", () => {
    chrome.storage.local.get("isPaused", (data) => {
      const newState = !data.isPaused; // Toggle the pause state
      chrome.storage.local.set({ isPaused: newState });
    });
  });

  // Initial call to set the status dot color based on the current state
  chrome.storage.local.get(["isPaused", "isOverrideActive"], (data) => {
    updateStatusDot(data.isPaused, data.isOverrideActive);
  });

  // Function to format and display the current date
  function showCurrentDateDay() {
    const dateElement = document.getElementById("current-date");
    const currentDate = new Date();
    const options = { weekday: "short", month: "short", day: "numeric" };
    const formattedDate = currentDate.toLocaleDateString("en-US", options);
    dateElement.textContent = formattedDate;
  }

  // Initial call to display the date
  showCurrentDateDay();

  // Update the date every second
  setInterval(showCurrentDateDay, 1000);
});
