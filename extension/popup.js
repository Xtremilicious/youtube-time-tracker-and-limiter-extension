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

  // Footer Stuff
  const footer = document.getElementById("popup-footer");
  const dismissButton = document.getElementById("dismiss-footer");

  document.getElementById("rate").addEventListener("click", () => {
    const ratePageURL =
      "https://addons.mozilla.org/en-US/firefox/addon/youtube-time-tracker-limiter";
    window.open(ratePageURL, "_blank");
  });

  // Constants
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  // Check if footer should be shown
  chrome.storage.local.get(["footerDismissedAt"], (result) => {
    const lastDismissed = result.footerDismissedAt || 0;
    const now = Date.now();

    if (now - lastDismissed > ONE_WEEK_MS) {
      footer.classList.remove("hidden");
    } else {
      footer.classList.add("hidden");
    }
  });

  // Handle dismiss button click
  dismissButton.addEventListener("click", () => {
    const now = Date.now();
    chrome.storage.local.set({ footerDismissedAt: now }, () => {
      footer.classList.add("hidden");
    });
  });

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
      if (isPaused) {
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
          changes.isPaused ? changes.isPaused.newValue : true,
          changes.isOverrideActive.newValue
        );
      }
    }
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

  //Time Tracking Stuff
  // Select the details element
  const detailsToggle = document.getElementById("time-tracker-toggle");
  const toggleIcon = document.getElementById("toggle-icon");
  const toggleText = document.getElementById("toggle-text");

  // Listen for toggle events
  detailsToggle.addEventListener("toggle", () => {
    if (detailsToggle.open) {
      // If details is open
      toggleIcon.className = "bi bi-arrow-bar-up"; // Change icon
      toggleText.textContent = "Hide Usage Insights"; // Change text
    } else {
      // If details is closed
      toggleIcon.className = "bi bi-arrow-bar-down"; // Change icon
      toggleText.textContent = "Show Usage Insights"; // Change text
    }
  });

  // Function to format time with singular/plural handling, excluding seconds
  function formatTimeUsage(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pluralize = (value, unit) =>
      value > 0 ? `${value} ${unit}${value > 1 ? "s" : ""}` : "";

    // If time is less than 1 minute, include seconds; otherwise, exclude seconds
    if (totalSeconds < 60) {
      return `${seconds} sec`;
    }

    return [
      pluralize(days, "day"),
      pluralize(hours, "hr"),
      pluralize(minutes, "min"),
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Function to calculate percentage change and return icon
  function getPercentageChange(current, previous) {
    if (!previous) return `<i class="bi bi-dash"></i>`; // No previous value

    const change = ((current - previous) / previous) * 100;

    // Set a limit for the percentage change
    const maxChange = 1000; // Maximum percentage change limit
    const cappedChange =
      Math.abs(change) > maxChange ? maxChange : Math.abs(change);

    return change > 0
      ? `<span class="metric-negative">${
          Math.abs(change) > maxChange ? ">" : "+"
        }${cappedChange.toFixed(
          1
        )}%</span><i class="bi bi-caret-up-fill metric-negative"></i>`
      : `<span class="metric-positive">${
          Math.abs(change) > maxChange ? ">" : "-"
        }${cappedChange.toFixed(
          1
        )}%</span><i class="bi bi-caret-down-fill metric-positive"></i>`;
  }

  // Fetch and update time tracking data for day, week, and year
  function updateTimeTracking() {
    chrome.storage.local.get(["timeTracking"], (data) => {
      const timeTracking = data.timeTracking || {};

      console.log(timeTracking);

      // Update "Today" section
      const todayTime = formatTimeUsage(timeTracking.today);
      const todayChange = getPercentageChange(
        timeTracking.today,
        timeTracking.yesterday
      );
      document.getElementById("time-tracker-day-time").innerHTML = todayTime;
      document.getElementById("time-tracker-day-change").innerHTML =
        todayChange;

      // Update "This week" section
      const weekTime = formatTimeUsage(timeTracking.currentWeek);
      const weekChange = getPercentageChange(
        timeTracking.currentWeek,
        timeTracking.previousWeek
      );
      document.getElementById("time-tracker-week-time").innerHTML = weekTime;
      document.getElementById("time-tracker-week-change").innerHTML =
        weekChange;

      // Update "This month" section
      const monthTime = formatTimeUsage(timeTracking.currentMonth);
      const monthChange = getPercentageChange(
        timeTracking.currentMonth,
        timeTracking.previousMonth
      );
      document.getElementById("time-tracker-month-time").innerHTML = monthTime;
      document.getElementById("time-tracker-month-change").innerHTML =
        monthChange;

      // Update "This year" section
      const yearTime = formatTimeUsage(timeTracking.currentYear);
      const yearChange = getPercentageChange(
        timeTracking.currentYear,
        timeTracking.previousYear
      );
      document.getElementById("time-tracker-year-time").innerHTML = yearTime;
      document.getElementById("time-tracker-year-change").innerHTML =
        yearChange;
    });
  }

  // Initial call to set the time tracking data
  updateTimeTracking();

  // Update the data every minute (60000 milliseconds)
  setInterval(updateTimeTracking, 1000);
});
