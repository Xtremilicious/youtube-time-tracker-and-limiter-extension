// Default values for the tracker state
let remainingTime = 0; // Remaining time in seconds
let activeTabId = null; // ID of the active tab
let isOverrideActive = false; // Flag to track override state
let pauseOnMinimize = false; // Flag to pause on minimize
let isPaused = false; // Flag to track if timer is paused
let timerInterval = null; // Interval ID for the timer
let overrideSetTimout = null; // Timeout for override duration
let isYouTubeTab = false; // Flag to track if the active tab is YouTube
let isYouTubeVisible = false; // Flag to track if YouTube is visible in the active tab

//Tracking Stuff
let trackerTimerInterval = null;
let totalSecondsWatched = 0;
let timeTracking = {};

/**
 * Load settings from local storage and set defaults if necessary.
 * @param {Function} callback - A callback function to execute once settings are loaded.
 */
function loadDefaultSettings(callback) {
  const defaultSettings = {
    dailyLimits: {
      Monday: 30,
      Tuesday: 30,
      Wednesday: 30,
      Thursday: 30,
      Friday: 30,
      Saturday: 30,
      Sunday: 30,
    },
    resetTime: "00:00", // Default reset time
    remainingTime: 30 * 60, // Default to 30 minutes
    pauseOnMinimize: true, // Default to pause on minimize
    overrideLimit: 10, // Default override duration in minutes
    timeTracking: {
      currentYear: 0,
      currentMonth: 0,
      currentWeek: 0,
      today: 0,
      previousYear: 0,
      previousMonth: 0,
      previousWeek: 0,
      yesterday: 0,
      totalTimeWatched: 0,
    },
  };

  // Load daily limits from storage or set defaults
  chrome.storage.local.get("dailyLimits", (data) => {
    if (!data.dailyLimits) {
      chrome.storage.local.set(defaultSettings, () => {
        console.log("Default settings saved to storage");
      });
    }

    const day = new Date().toLocaleString("en-US", { weekday: "long" });
    const dailyLimit = data?.dailyLimits?.[day] || 30;
    loadRemainingTime(dailyLimit, () => {
      updateBadge();
      if (callback) callback(data);
      updateAlarm();
    });
  });

  //Tracking Stuff
  chrome.storage.local.get("timeTracking", (data) => {
    const tracking = data.timeTracking || {};
    timeTracking = tracking;

    if (
      tracking.today === undefined ||
      tracking.totalTimeWatched === undefined ||
      tracking.currentYear === undefined ||
      tracking.currentMonth === undefined ||
      tracking.currentWeek === undefined
    ) {
      timeTracking = defaultSettings.timeTracking;
      chrome.storage.local.set({ timeTracking: defaultSettings.timeTracking });
    }
    resetDailyTracking();
  });
}

/**
 * Update the badge with the remaining time in minutes or hours.
 */
function updateBadge() {
  let badgeText;

  if (remainingTime >= 3600) {
    const hours = Math.floor(remainingTime / 3600);
    badgeText = `${hours}h`;
  } else if (remainingTime >= 60) {
    const minutes = Math.floor(remainingTime / 60);
    badgeText = `${minutes}m`;
  } else {
    badgeText = `${remainingTime}s`;
  }

  chrome.browserAction.setBadgeBackgroundColor({ color: "#ff0033" });
  chrome.browserAction.setBadgeText({ text: badgeText });
}

/**
 * Start the timer, decrementing remaining time every second.
 */
function startTimer() {
  if (!isOverrideActive) {
    chrome.storage.local.set({ isOverrideActive: false });
  }

  if (!timerInterval) {
    console.log("Starting the timer");
    timerInterval = setInterval(() => {
      if (remainingTime > 0 && !isOverrideActive && !isPaused) {
        remainingTime--;
        chrome.storage.local.set({ remainingTime, isPaused: false });
        updateBadge();
      } else if (remainingTime === 0 && !isOverrideActive) {
        clearInterval(timerInterval);
        timerInterval = null;
        notifyTimeUp();
        redirectToBlockingPage();
      }
    }, 1000);
    chrome.storage.local.set({ isPaused: false });
  }

  //Tracking Stuff
  if (!trackerTimerInterval) {
    trackerTimerInterval = setInterval(() => {
      totalSecondsWatched += 1;
      updateTimeTracking(1);
    }, 1000);
  }
}

// Format time for display (HH:MM:SS)
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
}

function resetDailyTracking() {
  return new Promise((resolve) => {
    const now = new Date();

    // Create a Date object for today at local midnight (00:00)
    const todayLocalDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ); // 00:00:00 local time

    chrome.storage.local.get(["lastTrackedDate", "timeTracking"], (result) => {
      const lastTrackedDateObj = result.lastTrackedDate
        ? new Date(result.lastTrackedDate) // Use the full Date-time object
        : now;

      // Normalize lastTrackedDate to local midnight (00:00)
      const lastTrackedDateOnly = new Date(
        lastTrackedDateObj.getFullYear(),
        lastTrackedDateObj.getMonth(),
        lastTrackedDateObj.getDate()
      );

      // Compare using only the date part
      if (
        lastTrackedDateOnly.toLocaleDateString() !==
        todayLocalDate.toLocaleDateString()
      ) {
        const updatedValues = {
          ...(result.timeTracking ?? {
            currentYear: 0,
            currentMonth: 0,
            currentWeek: 0,
            today: 0,
            previousYear: 0,
            previousMonth: 0,
            previousWeek: 0,
            yesterday: 0,
            totalTimeWatched: 0,
          }),
        };

        updatedValues.yesterday = result.timeTracking.today || 0;
        updatedValues.today = 0;

        // Week, month, and year transitions based on local time
        if (
          Math.floor(
            (todayLocalDate - lastTrackedDateOnly) / (1000 * 60 * 60 * 24)
          ) >= 7
        ) {
          updatedValues.previousWeek = result.timeTracking.currentWeek || 0;
          updatedValues.currentWeek = 0;
        }
        if (todayLocalDate.getMonth() !== lastTrackedDateOnly.getMonth()) {
          updatedValues.previousMonth = result.timeTracking.currentMonth || 0;
          updatedValues.currentMonth = 0;
        }
        if (
          todayLocalDate.getFullYear() !== lastTrackedDateOnly.getFullYear()
        ) {
          updatedValues.previousYear = result.timeTracking.currentYear || 0;
          updatedValues.currentYear = 0;
        }

        // Save updated time tracking and the current timestamp
        chrome.storage.local.set(
          { lastTrackedDate: now.toISOString(), timeTracking: updatedValues },
          () => {
            resolve(); // Reset completed
          }
        );
      } else {
        chrome.storage.local.set({ lastTrackedDate: now.toISOString() });
        resolve(); // No reset needed
      }
    });
  });
}

let isResetting = false;
function updateTimeTracking(seconds = 1) {
  console.log("Updating time tracking...");

  if (isResetting) return; // Prevent concurrent reset

  isResetting = true;

  resetDailyTracking().then(() => {
    chrome.storage.local.get("timeTracking", (result) => {
      const localTimeTracking = result.timeTracking || {};

      // Update timeTracking values
      const updatedValues = { ...localTimeTracking };
      updatedValues.today = (localTimeTracking.today || 0) + seconds;
      updatedValues.totalTimeWatched =
        (localTimeTracking.totalTimeWatched || 0) + seconds;

      // Directly update currentYear, currentMonth, currentWeek without comparisons
      updatedValues.currentYear =
        (localTimeTracking.currentYear || 0) + seconds;
      updatedValues.currentMonth =
        (localTimeTracking.currentMonth || 0) + seconds;
      updatedValues.currentWeek =
        (localTimeTracking.currentWeek || 0) + seconds;

      // Save updated values
      chrome.storage.local.set({ timeTracking: updatedValues }, () => {
        isResetting = false;
      });
    });
  });
}

/**
 * Redirect to the blocking page when the timer runs out.
 */
function redirectToBlockingPage() {
  const blockingPageURL = chrome.runtime.getURL("times-up.html");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    // Save the current URL (before redirecting) to storage
    chrome.storage.local.set({ originalUrl: activeTab.url });
    if (activeTab && activeTab.url.includes("youtube.com")) {
      chrome.tabs.update(activeTab.id, { url: blockingPageURL });
    }
  });
}

/**
 * Stop the timer when paused or reset.
 */
function stopTimer() {
  if (isPaused) {
    console.log("Timer already paused");
    return;
  }
  clearInterval(timerInterval);
  timerInterval = null;
  console.log("Timer stopped");
  chrome.storage.local.set({ isPaused: true });

  //Tracking Stuff
  clearInterval(trackerTimerInterval);
  trackerTimerInterval = null;
}

/**
 * Notify the user when the time is up.
 */
function notifyTimeUp() {
  chrome.notifications.create({
    title: "YouTube Time Limit Reached",
    message: "Your daily YouTube time is up!",
    iconUrl: "icon.png",
    type: "basic",
  });
}

/**
 * Reset the timer each day based on the configured reset time.
 */
function resetTimer() {
  const day = new Date().toLocaleString("en-US", { weekday: "long" });
  chrome.storage.local.get("dailyLimits", (data) => {
    const dailyLimits = data.dailyLimits || {};
    const dailyLimit = dailyLimits[day] || 0;
    remainingTime = dailyLimit * 60;
    chrome.storage.local.set({ remainingTime });
    updateBadge();
    overrideSetTimout = null;
    isOverrideActive = false;
    chrome.storage.local.set({ isOverrideActive });
  });
}

/**
 * Get the timestamp for the next reset based on the configured reset time.
 * @param {string} resetTime - The time at which the timer should reset (HH:mm).
 * @param {number} [savedTimestamp] - Optional saved alarm timestamp for reference.
 * @returns {number} - The timestamp for the next reset.
 */
function getResetTimestamp(resetTime, savedTimestamp) {
  const now = new Date();

  // If a saved timestamp exists and is in the future, return it
  if (savedTimestamp && savedTimestamp > now.getTime()) {
    return savedTimestamp;
  }

  const resetTimeToday = new Date(now.toDateString() + " " + resetTime);
  return resetTimeToday.getTime();
}

/**
 * Update the alarm for the next reset based on the reset time.
 */
function updateAlarm(forceUpdate = false) {
  chrome.storage.local.get(["resetTime", "alarmTimestamp"], (data) => {
    const resetTime = data.resetTime || "00:00";
    const savedTimestamp = !forceUpdate ? data.alarmTimestamp : null;

    console.log("resetTime:", resetTime);
    console.log(
      "savedTimestamp:",
      savedTimestamp ? new Date(savedTimestamp) : "None"
    );

    const resetTimestamp = getResetTimestamp(resetTime, savedTimestamp);
    const now = Date.now();

    // Adjust the timestamp if the reset time has passed
    const adjustedTimestamp =
      resetTimestamp <= now
        ? resetTimestamp + 24 * 60 * 60 * 1000 // Add 1 day if passed
        : resetTimestamp;

    console.log("adjustedTimestamp:", new Date(adjustedTimestamp));

    // Save the new alarm timestamp
    chrome.storage.local.set({ alarmTimestamp: adjustedTimestamp }, () => {
      console.log("Saved alarm timestamp:", new Date(adjustedTimestamp));
    });

    // Clear existing alarm and set a new one
    chrome.alarms.clear("resetTimerAlarm", () => {
      chrome.alarms.create("resetTimerAlarm", {
        when: adjustedTimestamp,
        periodInMinutes: 1440, // Repeat daily
      });
      console.log("Alarm set for:", new Date(adjustedTimestamp));
    });
  });
}

// Message listener for communication between background and other components (popup, content scripts)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "resetTimer":
      console.log("Resetting timer...");
      resetTimer();
      break;

    case "startTimer":
      console.log("Starting timer...");
      startTimer();
      break;

    case "pauseTimer":
      console.log("Pausing timer...");
      stopTimer();

    case "getRemainingTime":
      sendResponse({ time: remainingTime });
      break;

    case "activateOverride":
      isOverrideActive = true;
      chrome.storage.local.get(["overrideLimit"], (data) => {
        // Save the override status in chrome storage
        chrome.storage.local.set({ isOverrideActive: true });
        overrideSetTimout = setTimeout(() => {
          isOverrideActive = false;
          chrome.storage.local.set({ isOverrideActive: false });
          if (isYouTubeTab && isYouTubeVisible) {
            startTimer();
          }
        }, data.overrideLimit * 60 * 1000); // Override lasts for overrideLimit minutes
      });
      break;

    case "updateVisibility":
      chrome.storage.local.get(["pauseOnMinimize"], (data) => {
        const { isVisible } = message;
        isYouTubeVisible = isVisible;
        if (sender.tab.id === activeTabId) {
          if (isYouTubeVisible) {
            console.log("YouTube tab is visible. Resuming timer...");
            startTimer();
          } else if (data.pauseOnMinimize) {
            console.log("YouTube tab is not visible. Pausing timer...");
            stopTimer();
          }
        }
      });
      break;

    case "saveDailyLimit":
      resetTimer();
      break;

    case "saveResetTime":
      const { newResetTime } = message;
      console.log(`Saving new reset time: ${newResetTime}`);
      chrome.storage.local.set({ resetTime: newResetTime }, () => {
        console.log(`New reset time saved`);
        updateAlarm(true); // Reschedule the alarm with the new reset time
      });
      break;

    case "savePauseOnMinimize":
      const { pauseState } = message;
      console.log(`Saving pause on minimize state: ${pauseState}`);
      pauseOnMinimize = pauseState;
      chrome.storage.local.set({ pauseOnMinimize: pauseState });
      break;
    case "saveOverrideLimit":
      overrideSetTimout = setTimeout(() => {
        isOverrideActive = false;
        chrome.storage.local.set({ isOverrideActive: false });
      });
      break;
  }
});

// Load remaining time from local storage on startup
function loadRemainingTime(dailyLimit, callback) {
  chrome.storage.local.get("remainingTime", (data) => {
    if (data.remainingTime !== undefined) {
      remainingTime = data.remainingTime;
    } else {
      remainingTime = dailyLimit * 60; // Default to daily limit if not saved
      chrome.storage.local.set({ remainingTime });
    }
    updateBadge();
    if (callback) callback();
  });
}

// Initialize settings on installation or extension startup
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "YouTube Tracker Installed",
      message:
        "Click the Extensions icon (🔧) and pin YouTube Tracker for easy access!",
    });
  }
  loadDefaultSettings();
  chrome.storage.local.set({
    installedAt: new Date().toISOString().split("T")[0],
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Browser started. Checking active tab...");

  // Get the currently active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];

    if (activeTab && activeTab.url && activeTab.url.includes("youtube.com")) {
      console.log("Active YouTube tab detected on startup. Starting timer...");
      activeTabId = activeTab.id; // Set the active tab ID
      isYouTubeTab = true;
      isYouTubeVisible = true;

      startTimer(); // Start the timer for YouTube
    } else {
      console.log("No active YouTube tab detected on startup.");
      isYouTubeTab = false;
      isYouTubeVisible = false;
    }
  });

  // Load remaining time for badge update
  chrome.storage.local.get(["remainingTime", "dailyLimits"], (data) => {
    if (data.remainingTime !== undefined || data.dailyLimits !== undefined) {
      remainingTime = data.remainingTime;
      updateBadge();
    } else {
      loadDefaultSettings();
    }
  });

  // Load pause on minimize state from storage
  chrome.storage.local.get(["pauseOnMinimize"], (data) => {
    pauseOnMinimize = data.pauseOnMinimize ?? true;
  });

  chrome.storage.local.get(["resetTime", "alarmTimestamp"], (data) => {
    const resetTime = data.resetTime || "00:00";
    const savedTimestamp = data.alarmTimestamp;

    console.log("resetTime:", resetTime);
    console.log(
      "savedTimestamp:",
      savedTimestamp ? new Date(savedTimestamp) : "None"
    );

    // Calculate the reset timestamp using savedTimestamp if it exists
    const resetTimestamp = getResetTimestamp(resetTime, savedTimestamp);

    if (Date.now() >= resetTimestamp) {
      console.log("Reset time has passed. Triggering reset...");
      resetTimer();
    }

    // Reschedule the alarm
    updateAlarm();
  });

  chrome.storage.local.set({
    isPaused: undefined,
    isOverrideActive: undefined,
  });

  //Tracking Stuff
  chrome.storage.local.get("timeTracking", (data) => {
    timeTracking = data.timeTracking;
    resetDailyTracking();
  });
});

// Listen for tab activation (when a tab is clicked or switched to)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    activeTabId = tab.id; // Store active tab ID
    isYouTubeTab = tab.url.includes("youtube.com"); // Check if it's YouTube
    if (isYouTubeTab && isYouTubeVisible) {
      console.log("YouTube tab activated. Resuming timer...");
      startTimer();
      console.log(activeTabId);
    } else {
      console.log("Non-YouTube tab activated. Stopping timer...");
      stopTimer();
    }
  });
});

// Listen for tab updates (URL or content changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Ensure we only process when the tab's URL changes and it's the active tab
  if (changeInfo.url && tab.active) {
    const isNowYouTube = changeInfo.url.includes("youtube.com");
    const wasPreviouslyYouTube = isYouTubeTab && tabId === activeTabId;

    if (isNowYouTube) {
      // Update flags and start the timer if it wasn't already running
      activeTabId = tabId;
      isYouTubeTab = true;
      isYouTubeVisible = true;

      console.log("YouTube tab detected. Starting timer...");
      startTimer();
    } else if (wasPreviouslyYouTube) {
      // If the tab was previously YouTube but is no longer, stop the timer
      console.log("YouTube tab updated to non-YouTube. Stopping timer...");
      isYouTubeTab = false;
      stopTimer();
    }
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "resetTimerAlarm") {
    console.log("Reset timer alarm triggered. Resetting timer...");
    resetTimer();
  }
});
