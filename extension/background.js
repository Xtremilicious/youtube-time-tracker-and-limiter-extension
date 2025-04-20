// Define state objects
let timerState = {
  remainingTime: 0, // Remaining time in seconds
  activeTabId: null, // ID of the active tab
  isOverrideActive: false, // Flag to track override state
  pauseOnMinimize: true, // Initialize with default true
  isPaused: false, // Flag to track if timer is paused
  timerInterval: null, // Interval ID for the timer
  overrideSetTimout: null, // Timeout for override duration
  isYouTubeTab: false, // Flag to track if the active tab is YouTube
  isYouTubeVisible: false, // Flag to track if YouTube is visible in the active tab
};

let trackingState = {
  trackerTimerInterval: null,
  timeTracking: {}, // This will be populated by storage or defaults
  isResetting: false // Flag to prevent concurrent reset in updateTimeTracking
};

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
    resetTime: "00:00",
    remainingTime: 30 * 60,
    pauseOnMinimize: true,
    overrideLimit: 10,
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

  chrome.storage.local.set(defaultSettings, () => {
    console.log("Default settings saved to storage");

    const day = new Date().toLocaleString("en-US", { weekday: "long" });
    const dailyLimit = defaultSettings.dailyLimits[day] || 30;
    loadRemainingTime(dailyLimit, () => {
      // Initialize state from loaded/default settings
      timerState.remainingTime = defaultSettings.remainingTime;
      timerState.pauseOnMinimize = defaultSettings.pauseOnMinimize;
      trackingState.timeTracking = defaultSettings.timeTracking; // Initialize tracking state
      timerState.isPaused = false; // Reset paused state
      timerState.isOverrideActive = false; // Reset override state

      updateBadge();
      if (callback) callback();
      updateAlarm();
    });
  });
}

function loadSettingsPreservingTracking() {
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
    resetTime: "00:00",
    remainingTime: 30 * 60,
    pauseOnMinimize: true,
    overrideLimit: 10,
  };

  // Load settings while preserving timeTracking
  chrome.storage.local.get(null, (data) => {
    const newSettings = {
      ...defaultSettings,
      ...data, // Preserve existing data
      dailyLimits: data.dailyLimits || defaultSettings.dailyLimits,
      timeTracking: data.timeTracking || {
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

    chrome.storage.local.set(newSettings, () => {
      console.log("Settings updated while preserving tracking data");
      initializeExtensionState();
    });

    const day = new Date().toLocaleString("en-US", { weekday: "long" });
    const dailyLimit = newSettings.dailyLimits[day] || 30;
    loadRemainingTime(dailyLimit, () => {
      updateBadge();
      updateAlarm();

      //Tracking Stuff
      chrome.storage.local.get("timeTracking", (data) => {
        const tracking = data.timeTracking || {};
        // Update trackingState instead of global timeTracking
        trackingState.timeTracking = tracking;

        if (
          tracking.today === undefined ||
          tracking.totalTimeWatched === undefined ||
          tracking.currentYear === undefined ||
          tracking.currentMonth === undefined ||
          tracking.currentWeek === undefined
        ) {
          // If tracking data is incomplete, use default
          const defaultTracking = {
            currentYear: 0,
            currentMonth: 0,
            currentWeek: 0,
            today: 0,
            previousYear: 0,
            previousMonth: 0,
            previousWeek: 0,
            yesterday: 0,
            totalTimeWatched: 0,
          };
          trackingState.timeTracking = defaultTracking;
          chrome.storage.local.set({
            timeTracking: defaultTracking, // Save the default back to storage
          });
        }
        resetDailyTracking(); // Ensure daily tracking reset logic runs
      });
    });
  });
}

/**
 * Update the badge with the remaining time in minutes or hours.
 */
function updateBadge() {
  let badgeText;

  // Use timerState.remainingTime
  if (timerState.remainingTime >= 3600) {
    const hours = Math.floor(timerState.remainingTime / 3600);
    badgeText = `${hours}h`;
  } else if (timerState.remainingTime >= 60) {
    const minutes = Math.floor(timerState.remainingTime / 60);
    badgeText = `${minutes}m`;
  } else {
    badgeText = `${timerState.remainingTime}s`;
  }

  chrome.browserAction.setBadgeBackgroundColor({ color: "#ff0033" });
  chrome.browserAction.setBadgeText({ text: badgeText });
}

/**
 * Start the timer, decrementing remaining time every second.
 */
function startTimer() {
  chrome.runtime.sendMessage({ action: "resumeTimer" });
  // Use timerState
  if (!timerState.isOverrideActive) {
    chrome.storage.local.set({ isOverrideActive: false }); // Keep storing individual flag if needed elsewhere
  }

  if (!timerState.timerInterval) {
    console.log("Starting the timer");
    timerState.timerInterval = setInterval(() => {
      if (timerState.remainingTime > 0 && !timerState.isOverrideActive && !timerState.isPaused) {
        timerState.remainingTime--;
        // Batch storage updates if possible, or keep individual for simplicity for now
        chrome.storage.local.set({ remainingTime: timerState.remainingTime, isPaused: false });
        updateBadge();
      } else if (timerState.remainingTime === 0 && !timerState.isOverrideActive) {
        clearInterval(timerState.timerInterval);
        timerState.timerInterval = null;
        notifyTimeUp();
        redirectToBlockingPage();
      }
    }, 1000);
    timerState.isPaused = false; // Update state directly
    chrome.storage.local.set({ isPaused: false }); // Update storage
  }

  //Tracking Stuff - Use trackingState
  if (!trackingState.trackerTimerInterval) {
    trackingState.trackerTimerInterval = setInterval(() => {
      // totalSecondsWatched is removed, logic now in updateTimeTracking
      updateTimeTracking(1); // Updates trackingState.timeTracking internally

      console.log(`Time watched today: ${formatTime(trackingState.timeTracking.today)}`);
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

      console.log(new Date(result.lastTrackedDate), now);

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
        // Use trackingState.timeTracking
        const updatedValues = {
          ...(result.timeTracking ?? { // Use the result directly as it holds the stored tracking data
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

        updatedValues.yesterday = result.timeTracking.today || 0; // Access directly from result
        updatedValues.today = 0;

        // Get the week number for both dates
        const getWeekNumber = (date) => {
          const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
          const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
          return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        };

        // Week, month, and year transitions based on local time
        const lastWeek = getWeekNumber(lastTrackedDateOnly);
        const currentWeek = getWeekNumber(todayLocalDate);

        // Check if week has changed
        if (lastWeek !== currentWeek) {
          updatedValues.previousWeek = result.timeTracking.currentWeek || 0; // Access directly from result
          updatedValues.currentWeek = 0;
        }
        // Check if month has changed
        if (todayLocalDate.getMonth() !== lastTrackedDateOnly.getMonth()) {
          updatedValues.previousMonth = result.timeTracking.currentMonth || 0; // Access directly from result
          updatedValues.currentMonth = 0;
        }
        // Check if year has changed
        if (
          todayLocalDate.getFullYear() !== lastTrackedDateOnly.getFullYear()
        ) {
          updatedValues.previousYear = result.timeTracking.currentYear || 0; // Access directly from result
          updatedValues.currentYear = 0;
        }

        // Save updated time tracking and the current timestamp
        chrome.storage.local.set(
          { lastTrackedDate: now.toISOString(), timeTracking: updatedValues },
          () => {
            trackingState.timeTracking = updatedValues; // Update local state after saving
            resolve(); // Reset completed
          }
        );
      } else {
        chrome.storage.local.set({ lastTrackedDate: now.toISOString() });
        trackingState.timeTracking = result.timeTracking; // Ensure local state is current
        resolve(); // No reset needed
      }
    });
  });
}

function updateTimeTracking(seconds = 1) {
  console.log("Updating time tracking...");

  if (trackingState.isResetting) return; // Prevent concurrent reset using state object

  trackingState.isResetting = true;

  resetDailyTracking().then(() => {
    // No need to get again if resetDailyTracking updates trackingState.timeTracking
    // Use the state variable directly which was updated by resetDailyTracking or initialized
    const localTimeTracking = trackingState.timeTracking || {}; // Use state

    // Update timeTracking values in state
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
      console.log("Time tracking updated:", updatedValues);
      trackingState.timeTracking = updatedValues; // Update state after saving
      trackingState.isResetting = false; // Release lock
    });
    // Removed the redundant get call
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
  // Use timerState
  if (timerState.isPaused) {
    console.log("Timer already paused");
    return;
  }
  clearInterval(timerState.timerInterval);
  timerState.timerInterval = null;
  timerState.isPaused = true; // Update state directly
  console.log("Timer stopped");
  chrome.storage.local.set({ isPaused: true }); // Update storage

  //Tracking Stuff - Use trackingState
  if (trackingState.trackerTimerInterval) {
    clearInterval(trackingState.trackerTimerInterval);
    trackingState.trackerTimerInterval = null;
  }
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
    // Use timerState
    timerState.remainingTime = dailyLimit * 60;
    chrome.storage.local.set({ remainingTime: timerState.remainingTime }); // Use timerState
    updateBadge();
    // Use timerState for override properties
    clearTimeout(timerState.overrideSetTimout); // Clear any existing override timeout
    timerState.overrideSetTimout = null;
    timerState.isOverrideActive = false;
    chrome.storage.local.set({ isOverrideActive: false }); // Update storage
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
      sendResponse({ time: timerState.remainingTime });
      break;

    case "activateOverride":
      // Use timerState
      timerState.isOverrideActive = true;
      // Save the override status in chrome storage
      chrome.storage.local.set({ isOverrideActive: true });
      // Clear previous timeout if exists
      if (timerState.overrideSetTimout) {
         clearTimeout(timerState.overrideSetTimout);
      }
      timerState.overrideSetTimout = setTimeout(() => {
        timerState.isOverrideActive = false;
        chrome.storage.local.set({ isOverrideActive: false });
        // Check timerState flags before starting
        if (timerState.isYouTubeTab && timerState.isYouTubeVisible) {
          startTimer();
        }
      }, message.overrideLimit * 60 * 1000); // Override lasts for overrideLimit minutes
      break;

    case "updateVisibility":
      const { isVisible } = message;
      // Use timerState
      timerState.isYouTubeVisible = isVisible;
      console.log(
        "pauseOnMinimize:",
        timerState.pauseOnMinimize, // Use timerState
        "isYouTubeVisible:",
        timerState.isYouTubeVisible // Use timerState
      );

      // Use timerState
      if (sender.tab.id === timerState.activeTabId) {
        if (timerState.isYouTubeVisible) {
          console.log("YouTube tab is visible. Resuming timer...");
          startTimer();
        } else {
          console.log(
            "YouTube tab is not visible. Checking pauseOnMinimize setting..."
          );
          // Use timerState
          if (timerState.pauseOnMinimize) {
            console.log("Pausing timer because pauseOnMinimize is true.");
            stopTimer();
          }
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
      // Update both the state variable and storage
      timerState.pauseOnMinimize = pauseState; // Use timerState
      chrome.storage.local.set({ pauseOnMinimize: pauseState }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error saving pauseOnMinimize:",
            chrome.runtime.lastError
          );
        }
      });
      break;
    case "saveOverrideLimit":
      // This case seems incomplete. It just clears the timeout?
      // Assuming it should re-activate the override logic or similar.
      // Keeping existing logic but noting potential issue.
      if (timerState.overrideSetTimout) { // Use timerState
         clearTimeout(timerState.overrideSetTimout);
      }
      // Perhaps the intention was to clear the *existing* override immediately
      // when the limit changes? Or restart it with the new limit? Needs clarification.
      // For now, just clearing the existing timeout reference.
      timerState.overrideSetTimout = null; // Clear reference in state
      // If override was active, it might need to be reset or restarted here based on intent.
      break;
  }

  return true; // Indicates async response
});

// Load remaining time from local storage on startup
function loadRemainingTime(dailyLimit, callback) {
  chrome.storage.local.get("remainingTime", (data) => {
    if (data.remainingTime !== undefined) {
      timerState.remainingTime = data.remainingTime; // Use timerState
    } else {
      timerState.remainingTime = dailyLimit * 60; // Default to daily limit if not saved
      chrome.storage.local.set({ remainingTime: timerState.remainingTime }); // Use timerState
    }
    updateBadge();
    if (callback) callback();
  });
}

// Initialize settings on installation or extension startup
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Setting default value for pauseOnMinimize on install.");
    chrome.storage.local.set({ pauseOnMinimize: true }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error setting default pauseOnMinimize:",
          chrome.runtime.lastError
        );
      }
    });
  } else if (details.reason === "update") {
    chrome.storage.local.get("pauseOnMinimize", (data) => {
      if (data.pauseOnMinimize === undefined) {
        console.log("Setting default pauseOnMinimize after update.");
        chrome.storage.local.set({ pauseOnMinimize: true });
        timerState.pauseOnMinimize = true; // Update state
      } else {
        timerState.pauseOnMinimize = data.pauseOnMinimize; // Load existing into state
      }
    });
  }

  chrome.storage.local.set({
    installedAt: new Date().toISOString().split("T")[0],
  });

  // Ensure other initial setup happens after defaults are potentially set
  loadSettingsPreservingTracking(); // Or loadDefaultSettings() if appropriate
  // Restore the notification from the previous incorrect edit if desired
  if (details.reason === "install") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "assets/icons/icon.png", // Correct path?
      title: "YouTube Tracker Installed",
      message:
        "Click the Extensions icon and pin YouTube Tracker for easy access!",
    });
  }

  // Reload YouTube tabs on install/update
  if (details.reason === "install" || details.reason === "update") {
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
      console.log(`Found ${tabs.length} YouTube tabs to reload.`);
      tabs.forEach((tab) => {
        chrome.tabs.reload(tab.id, (result) => {
          if (chrome.runtime.lastError) {
            console.error(`Error reloading tab ${tab.id}: ${chrome.runtime.lastError.message}`);
          } else {
            console.log(`Reloaded tab ${tab.id}`);
          }
        });
      });
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Browser started. Checking active tab...");

  // Consolidate initialization logic into a single call
  initializeExtensionState();
});

// Listen for tab activation (when a tab is clicked or switched to)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    // Use timerState
    timerState.activeTabId = tab.id; // Store active tab ID
    timerState.isYouTubeTab = tab.url.includes("youtube.com"); // Check if it's YouTube

    // Assume tab becomes visible on activation, then check if we should pause
    timerState.isYouTubeVisible = true; // Assume visible initially

    if (timerState.isYouTubeTab) { // No need to check isYouTubeVisible here, startTimer handles pausing
      console.log("YouTube tab activated. Starting timer (will pause if needed)...");
      startTimer();
    } else {
      console.log("Non-YouTube tab activated. Stopping timer...");
      stopTimer(); // Stop timer if not YouTube
    }
    // Visibility check logic is now primarily handled by content script sending 'updateVisibility'
  });
});

// Listen for tab updates (URL or content changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Ensure we only process when the tab's URL changes and it's the active tab
  // Use timerState
  if (changeInfo.url && tab.active && tabId === timerState.activeTabId) {
    const isNowYouTube = changeInfo.url.includes("youtube.com");
    // const wasPreviouslyYouTube = timerState.isYouTubeTab && tabId === timerState.activeTabId; // Already checked activeTabId

    if (isNowYouTube) {
      // Update flags and start the timer if it wasn't already running
      timerState.isYouTubeTab = true;
      timerState.isYouTubeVisible = true; // Assume visible on URL update

      console.log("Active tab updated to YouTube URL. Starting timer...");
      startTimer();
    } else { // If URL changed *away* from YouTube on the active tab
      console.log("Active tab updated to non-YouTube URL. Stopping timer...");
      timerState.isYouTubeTab = false;
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

function initializeExtensionState() {
  console.log("Initializing extension state...");
  // Load all necessary settings from storage in one go
  chrome.storage.local.get(
    [
      "dailyLimits",
      "pauseOnMinimize",
      "remainingTime",
      "resetTime",
      "alarmTimestamp",
      "timeTracking",
      "lastTrackedDate", // Needed for resetDailyTracking
      // Removed isPaused, isOverrideActive as they are transient state managed internally
    ],
    (data) => {
      const day = new Date().toLocaleString("en-US", { weekday: "long" });
      const defaultDailyLimits = {
        Monday: 30, Tuesday: 30, Wednesday: 30, Thursday: 30,
        Friday: 30, Saturday: 30, Sunday: 30
      };
      const defaultTimeTracking = {
        currentYear: 0, currentMonth: 0, currentWeek: 0, today: 0,
        previousYear: 0, previousMonth: 0, previousWeek: 0, yesterday: 0,
        totalTimeWatched: 0
      };

      const dailyLimits = data.dailyLimits || defaultDailyLimits;
      const dailyLimit = dailyLimits[day] || 30; // Use default 30 if specific day is missing
      const resetTime = data.resetTime || "00:00";

      // --- Initialize Timer State ---
      timerState.pauseOnMinimize = data.pauseOnMinimize ?? true;
      if (data.remainingTime !== undefined) {
        timerState.remainingTime = data.remainingTime;
      } else {
        timerState.remainingTime = dailyLimit * 60; // Default based on today's limit
        chrome.storage.local.set({ remainingTime: timerState.remainingTime }); // Save if defaulted
      }
      timerState.isPaused = false; // Assume not paused initially
      timerState.isOverrideActive = false; // Assume override not active initially
      timerState.activeTabId = null; // Reset active tab
      timerState.isYouTubeTab = false;
      timerState.isYouTubeVisible = false;

      // --- Initialize Tracking State ---
      trackingState.timeTracking = data.timeTracking || defaultTimeTracking;
      // If timeTracking was missing, save the default back
      if (!data.timeTracking) {
          chrome.storage.local.set({ timeTracking: defaultTimeTracking });
      }

      // --- Update UI & Alarms ---
      updateBadge();
      updateAlarm(); // Reads resetTime and alarmTimestamp (already loaded in 'data')

      // --- Perform Initial Checks ---
      // Check if reset time has passed since last run
      const savedTimestamp = data.alarmTimestamp;
      const resetTimestamp = getResetTimestamp(resetTime, savedTimestamp);
      if (Date.now() >= resetTimestamp) {
        console.log("Reset time has passed since last run. Triggering reset...");
        resetTimer(); // Reset timer state immediately
      }

      // Perform daily tracking reset check
      resetDailyTracking().then(() => {
        console.log("Daily tracking check complete.");
        // Now that tracking state is confirmed, check active tab
        checkActiveTabOnStartup();
      });

      // Clear potentially stale flags from storage (ensure state object is source of truth)
      chrome.storage.local.remove(["isPaused", "isOverrideActive"]);

      console.log("Extension state initialized.", { timerState, trackingState });
    }
  );
}

/**
* Checks the active tab on startup and starts the timer if it's a YouTube tab.
* Should be called after initial state is loaded.
*/
function checkActiveTabOnStartup() {
 chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
   const activeTab = tabs[0];

   if (activeTab && activeTab.url && activeTab.url.includes("youtube.com")) {
     console.log("Active YouTube tab detected on startup. Starting timer...");
     timerState.activeTabId = activeTab.id;
     timerState.isYouTubeTab = true;
     // Visibility should be reported by content script via 'updateVisibility'
     // timerState.isYouTubeVisible = true; // Avoid assuming visibility
     startTimer();
   } else {
     console.log("No active YouTube tab detected on startup.");
     // State already defaults to non-YouTube
   }
 });
}
