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
  if (timerInterval) {
    console.log("Timer already running");
    chrome.runtime.sendMessage({ action: "resumeTimer" });
    return;
  }
  if (!isOverrideActive) {
    chrome.storage.local.set({ isOverrideActive: false });
  }

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

    case "getRemainingTime":
      sendResponse({ time: remainingTime });
      break;

    case "activateOverride":
      isOverrideActive = true;
      // Save the override status in chrome storage
      chrome.storage.local.set({ isOverrideActive: true });
      overrideSetTimout = setTimeout(() => {
        isOverrideActive = false;
        chrome.storage.local.set({ isOverrideActive: false });
        if (isYouTubeTab && isYouTubeVisible) {
          startTimer();
        }
      }, message.overrideLimit * 60 * 1000); // Override lasts for overrideLimit minutes
      break;

    case "updateVisibility":
      const { isVisible } = message;
      isYouTubeVisible = isVisible;
      console.log(
        "pauseOnMinimize:",
        pauseOnMinimize,
        "isYouTubeVisible:",
        isYouTubeVisible
      );

      if (sender.tab.id === activeTabId) {
        if (isYouTubeVisible) {
          console.log("YouTube tab is visible. Resuming timer...");
          startTimer();
        } else if (pauseOnMinimize) {
          console.log("YouTube tab is not visible. Pausing timer...");
          stopTimer();
        }
      }
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
      break;
    case "saveOverrideLimit":
      overrideSetTimout = setTimeout(() => {
        isOverrideActive = false;
        chrome.storage.local.set({ isOverrideActive: false });
      });
      break;
  }

  return true; // Indicates async response
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
});

// Listen for tab activation (when a tab is clicked or switched to)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    activeTabId = tab.id; // Store active tab ID
    isYouTubeTab = tab.url.includes("youtube.com"); // Check if it's YouTube
    if (isYouTubeTab && isYouTubeVisible) {
      console.log("YouTube tab activated. Resuming timer...");
      startTimer();
    } else {
      console.log("Non-YouTube tab activated. Stopping timer...");
      stopTimer();
    }
  });
});

// Listen for tab updates (URL or content changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Ensure we only process when the tab's URL changes
  if (changeInfo.url) {
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
