// Define state objects
let timerState = {
  activeTabId: null, // ID of the active tab
  isOverrideActive: false, // Flag to track override state
  isPaused: false, // Flag to track if timer is paused
  isWindowMinimized: false, // Flag to track if window is minimized
  isYouTubeTab: false, // Flag to track if the active tab is YouTube
  isYouTubeVisible: false, // Flag to track if YouTube is visible in the active tab
  overrideAlarmName: "overrideEndAlarm", // Name for the override alarm
  overrideSetTimout: null, // Timeout for override duration - TO BE REPLACED by alarm
  pauseOnMinimize: true, // Initialize with default true
  remainingTime: 0, // Remaining time in seconds
};

let trackingState = {
  // trackerTimerInterval: null, // REMOVED: Interval ID for the tracker (Integrated with timerTickAlarm)
  timeTracking: {}, // This will be populated by storage or defaults
  isResetting: false, // Flag to prevent concurrent reset in updateTimeTracking
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

  chrome.action.setBadgeBackgroundColor({ color: "#ff0033" });
  chrome.action.setBadgeText({ text: badgeText });
}

/**
 * Start the timer, decrementing remaining time every second.
 */
function startTimer() {
  // chrome.runtime.sendMessage({ action: "resumeTimer" }); // REMOVED: No receiving end
  // Use timerState
  if (!timerState.isOverrideActive) {
    chrome.storage.local.set({ isOverrideActive: false }); // Keep storing individual flag if needed elsewhere
  }

  // --- Alarm-based Timer Logic --- //
  // Check if the timer should actually start
  // Only prevent starting if explicitly paused.
  // Override state is handled within handleTimerTick.
  if (timerState.isPaused) {
    console.log("Timer state:", timerState);
    console.log("Timer start condition not met (paused).");
    return; // Don't start if paused
  }

  console.log("Attempting to start timer alarm.");
  timerState.isPaused = false;
  // --- Update lastTickTimestamp on start/restart --- //
  const now = Date.now();
  chrome.storage.local.set({ isPaused: false, lastTickTimestamp: now });
  console.log(
    "Updated lastTickTimestamp to now to prevent time jump on resume."
  );

  // Create the repeating alarm
  // We'll use a 1-minute period and handle finer-grained updates within the alarm listener
  chrome.alarms.create("timerTickAlarm", { periodInMinutes: 1 / 60 });
  console.log("Created/updated timerTickAlarm with 1-minute period.");

  updateBadge(); // Update badge immediately to reflect potential state change
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
          ...(result.timeTracking ?? {
            // Use the result directly as it holds the stored tracking data
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

  if (trackingState.isResetting) return; // Prevent concurrent updates

  trackingState.isResetting = true;

  // Use the state variable directly
  const localTimeTracking = trackingState.timeTracking || {};

  // Update timeTracking values in state
  const updatedValues = { ...localTimeTracking };
  updatedValues.today = (localTimeTracking.today || 0) + seconds;
  updatedValues.totalTimeWatched =
    (localTimeTracking.totalTimeWatched || 0) + seconds;
  updatedValues.currentYear = (localTimeTracking.currentYear || 0) + seconds;
  updatedValues.currentMonth =
    (localTimeTracking.currentMonth || 0) + seconds;
  updatedValues.currentWeek = (localTimeTracking.currentWeek || 0) + seconds;

  // Save updated values
  chrome.storage.local.set({ timeTracking: updatedValues }, () => {
    console.log("Time tracking updated:", updatedValues);
    trackingState.timeTracking = updatedValues; // Update state after saving
    trackingState.isResetting = false; // Release lock
  });
}

/**
 * Redirect to the blocking page when the timer runs out.
 * Targets the specific tab being tracked (timerState.activeTabId).
 */
function redirectToBlockingPage() {
  const blockingPageURL = chrome.runtime.getURL("times-up.html");
  const trackedTabId = timerState.activeTabId;

  if (!trackedTabId) {
    console.error(
      "redirectToBlockingPage called but no trackedTabId found in state."
    );
    return;
  }

  chrome.tabs.get(trackedTabId, (tab) => {
    // Check for errors (e.g., tab closed before redirection)
    if (chrome.runtime.lastError) {
      console.warn(
        `Error getting tab ${trackedTabId} for redirection: ${chrome.runtime.lastError.message}. It might have been closed.`
      );
      return;
    }

    // Ensure the tab still exists and is a YouTube tab
    if (tab && tab.url && tab.url.includes("youtube.com")) {
      console.log(
        `Redirecting tracked YouTube tab ${trackedTabId} to blocking page.`
      );
      // Save the tracked tab's original URL
      chrome.storage.local.set({ originalUrl: tab.url }, () => {
        // Update the tracked tab's URL
        chrome.tabs.update(trackedTabId, { url: blockingPageURL }, () => {
          if (chrome.runtime.lastError) {
            console.error(
              `Error updating tab ${trackedTabId} to blocking page: ${chrome.runtime.lastError.message}`
            );
          }
        });
      });
    } else {
      console.log(
        `Did not redirect tab ${trackedTabId}. Tab not found, URL changed, or no longer YouTube.`
      );
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

  // --- Alarm-based Timer Logic --- //
  console.log("Clearing timerTickAlarm.");
  chrome.alarms.clear("timerTickAlarm");

  timerState.isPaused = true; // Update state directly
  console.log("Timer stopped (alarm cleared)");
  chrome.storage.local.set({ isPaused: true }); // Update storage
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
      console.log("Activating override...");
      // Use timerState
      timerState.isOverrideActive = true;
      // Save the override status in chrome storage
      chrome.storage.local.set({
        isOverrideActive: true,
        lastTickTimestamp: Date.now(),
      }); // Update timestamp to prevent immediate large tick

      // --- Replace setTimeout with alarm --- //
      // Check if the received limit is a valid number (including 0)
      let overrideDurationMinutes;
      if (
        typeof message.overrideLimit === "number" &&
        !isNaN(message.overrideLimit)
      ) {
        overrideDurationMinutes = message.overrideLimit;
      } else {
        console.warn(
          `Invalid or missing overrideLimit in message (${message.overrideLimit}), defaulting to 10.`
        );
        overrideDurationMinutes = 10; // Default to 10 only if invalid/missing
      }

      // *** ADDED LOGGING: Check the value being used ***
      console.log(
        `Override requested. Using duration: ${overrideDurationMinutes} minutes (from message.overrideLimit: ${message.overrideLimit})`
      );
      console.log(
        `Setting override alarm for ${overrideDurationMinutes} minutes.`
      );

      // Clear existing override alarm before setting a new one
      chrome.alarms.clear(timerState.overrideAlarmName, (wasCleared) => {
        console.log(`Previous override alarm cleared: ${wasCleared}`);
        chrome.alarms.create(timerState.overrideAlarmName, {
          delayInMinutes: overrideDurationMinutes,
        });
        console.log(
          `Override alarm '${timerState.overrideAlarmName}' created.`
        );
      });

      // Clear previous timeout reference if exists (belt and suspenders)
      if (timerState.overrideSetTimout) {
        clearTimeout(timerState.overrideSetTimout);
        timerState.overrideSetTimout = null;
      }
      break;

    case "updateVisibility":
      const isVisible = message.isVisible && !timerState.isWindowMinimized;
      timerState.isYouTubeVisible = isVisible;

      // Store visibility state
      chrome.storage.local.set({
        isYouTubeVisible: timerState.isYouTubeVisible,
      });

      console.log(
        `Visibility updated: isVisible = ${isVisible}, pauseOnMinimize = ${timerState.pauseOnMinimize}, isWindowMinimized = ${timerState.isWindowMinimized}`
      );

      // Only act if this message is from the currently active tab
      if (sender.tab && sender.tab.id === timerState.activeTabId) {
        if (isVisible) {
          console.log(
            "YouTube tab became visible. Ensuring timer is running..."
          );
          timerState.isPaused = false;
          chrome.storage.local.set({ isPaused: false });
          startTimer();
        } else {
          console.log(
            "YouTube tab became hidden. Checking pauseOnMinimize setting..."
          );
          if (timerState.pauseOnMinimize) {
            console.log("Pausing timer because pauseOnMinimize is true.");
            timerState.isPaused = true;
            chrome.storage.local.set({ isPaused: true });
            stopTimer();
          } else {
            console.log(
              "pauseOnMinimize is false. Timer continues running in background."
            );
          }
        }
      } else {
        console.log(
          "Visibility update received from non-active tab, ignoring timer controls."
        );
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
      if (timerState.overrideSetTimout) {
        // Use timerState
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
            console.error(
              `Error reloading tab ${tab.id}: ${chrome.runtime.lastError.message}`
            );
          } else {
            console.log(`Reloaded tab ${tab.id}`);
          }
        });
      });
    });
  }
});

// Consolidate initialization logic into a single call
// initializeExtensionState(); // Moved to top-level execution

// Listen for tab activation (when a tab is clicked or switched to)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error(
        `Error getting tab info: ${chrome.runtime.lastError.message}`
      );
      return;
    }
    if (!tab) {
      console.error("Failed to get tab info for ID:", activeInfo.tabId);
      return;
    }

    // Use timerState
    timerState.activeTabId = tab.id; // Store active tab ID
    timerState.isYouTubeTab = tab.url && tab.url.includes("youtube.com"); // Check if it's YouTube

    // --- Store tab state --- //
    chrome.storage.local.set({
      activeTabId: timerState.activeTabId,
      isYouTubeTab: timerState.isYouTubeTab,
      // Assume visible on activation, content script will correct if needed
      isYouTubeVisible: true,
    });

    // Assume tab becomes visible on activation, then check if we should pause
    timerState.isYouTubeVisible = true; // Assume visible initially

    if (timerState.isYouTubeTab) {
      // *** MODIFIED CHECK: Redirect only if time is zero AND override is NOT active ***
      if (timerState.remainingTime <= 0 && !timerState.isOverrideActive) {
        console.log(
          "YouTube tab activated, time is zero, no override. Redirecting..."
        );
        redirectToBlockingPage();
        return; // Don't start the timer
      }
      // No need to check isYouTubeVisible here, startTimer handles pausing
      console.log(
        "YouTube tab activated. Ensuring timer is not paused (or override active) and starting..."
      );
      // --- Explicitly set paused to false on activation before starting --- //
      timerState.isPaused = false;
      chrome.storage.local.set({ isPaused: false }); // Persist this intent
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

    // --- Store potentially changed tab state --- //
    timerState.isYouTubeTab = isNowYouTube;
    timerState.isYouTubeVisible = true; // Assume visible on URL update
    chrome.storage.local.set({
      isYouTubeTab: timerState.isYouTubeTab,
      isYouTubeVisible: timerState.isYouTubeVisible,
      // activeTabId doesn't change here
    });

    if (isNowYouTube) {
      // *** MODIFIED CHECK: Redirect only if time is zero AND override is NOT active ***
      if (timerState.remainingTime <= 0 && !timerState.isOverrideActive) {
        console.log(
          "Active tab updated to YouTube URL, time zero, no override. Redirecting..."
        );
        redirectToBlockingPage();
        return; // Don't start the timer
      }
      // Update flags and start the timer if it wasn't already running
      timerState.isYouTubeTab = true;
      timerState.isYouTubeVisible = true; // Assume visible on URL update

      console.log(
        "Active tab updated to YouTube URL. Starting timer (or allowing override)..."
      );
      startTimer();
    } else {
      // If URL changed *away* from YouTube on the active tab
      console.log("Active tab updated to non-YouTube URL. Stopping timer...");
      timerState.isYouTubeTab = false;
      stopTimer();
    }
  }
});

// --- ALARM LISTENER --- //
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log(`Alarm triggered: ${alarm.name}`);

  if (alarm.name === "resetTimerAlarm") {
    console.log("Reset timer alarm triggered. Resetting timer...");
    resetTimer();
  } else if (alarm.name === "timerTickAlarm") {
    handleTimerTick();
  } else if (alarm.name === timerState.overrideAlarmName) {
    handleOverrideEnd();
  } else if (alarm.name === "trackingResetAlarm") {
    console.log("Tracking reset alarm triggered. Resetting daily tracking...");
    resetDailyTracking();
  }
});

// --- NEW: Handles the logic for each timer tick --- //
async function handleTimerTick() {
  console.log("Handling timer tick...");

  // Get the current state and last tick time
  const data = await chrome.storage.local.get([
    "remainingTime",
    "isPaused",
    "isOverrideActive",
    "lastTickTimestamp",
  ]);

  // Re-populate state from storage to ensure consistency after potential service worker sleep
  timerState.remainingTime = data.remainingTime ?? timerState.remainingTime;
  timerState.isPaused = data.isPaused ?? timerState.isPaused;
  timerState.isOverrideActive =
    data.isOverrideActive ?? timerState.isOverrideActive;

  const now = Date.now();
  const lastTick = data.lastTickTimestamp || now; // Use now if no previous tick (first run)
  const elapsedSeconds = Math.round((now - lastTick) / 1000);

  // Log state for debugging
  console.log("Timer tick state:", {
    isPaused: timerState.isPaused,
    isOverrideActive: timerState.isOverrideActive,
    elapsedSeconds: elapsedSeconds,
    remainingTime: timerState.remainingTime,
  });

  // 1. Handle insignificant time elapsed
  if (elapsedSeconds <= 0) {
    console.log(
      "No significant time elapsed since last tick. Updating timestamp."
    );
    await chrome.storage.local.set({ lastTickTimestamp: now }); // Still update timestamp
    return;
  }

  // 2. Handle Paused State (No tracking, no timer decrement)
  if (timerState.isPaused) {
    console.log(
      "Timer tick ignored (paused). Clearing alarm and updating timestamp."
    );
    chrome.alarms.clear("timerTickAlarm");
    await chrome.storage.local.set({ lastTickTimestamp: now }); // Update timestamp to prevent jump on resume
    return;
  }

  // 3. If NOT Paused, tracking SHOULD occur
  console.log("Timer not paused. Updating tracking...");
  updateTimeTracking(elapsedSeconds); // Update by actual elapsed time

  // 4. Handle Override State (Tracking done, no timer decrement)
  if (timerState.isOverrideActive) {
    console.log("Override active. Tracking done, only updating timestamp.");
    await chrome.storage.local.set({ lastTickTimestamp: now }); // Store current time as the last tick
    return; // Skip timer decrement and badge update
  }

  // 5. Handle Timer Running Normally (Not paused, not override)
  console.log("Timer running normally.");
  if (timerState.remainingTime > 0) {
    timerState.remainingTime -= elapsedSeconds;
    if (timerState.remainingTime < 0) timerState.remainingTime = 0;

    console.log(
      `Decrementing time. New remainingTime: ${timerState.remainingTime}`
    );

    // Update badge and store new state
    updateBadge();
    await chrome.storage.local.set({
      remainingTime: timerState.remainingTime,
      lastTickTimestamp: now, // Store current time as the last tick
    });

    // Check if time has run out
    if (timerState.remainingTime === 0) {
      console.log("Time is up! Clearing alarm and notifying.");
      chrome.alarms.clear("timerTickAlarm");
      notifyTimeUp();
      redirectToBlockingPage();
    } else {
      // Optional: Schedule next alarm more precisely if needed,
      // otherwise rely on the 1-minute periodInMinutes
    }
  } else {
    // Time was already 0 when tick occurred
    console.log("Timer tick handled, but time was already 0. Clearing alarm.");
    chrome.alarms.clear("timerTickAlarm");
    await chrome.storage.local.set({ lastTickTimestamp: now }); // Still update timestamp
  }
}

// --- NEW: Handles the end of the override period --- //
async function handleOverrideEnd() {
  console.log("Override period ended.");
  timerState.isOverrideActive = false;
  await chrome.storage.local.set({ isOverrideActive: false });
  clearTimeout(timerState.overrideSetTimout); // Clear legacy timeout reference
  timerState.overrideSetTimout = null;

  // *** ADDED CHECK: If time is still zero after override ends, redirect immediately ***
  if (timerState.remainingTime <= 0) {
    console.log("Override ended, but time is still zero. Redirecting...");
    redirectToBlockingPage();
    return; // Don't proceed to potentially start the timer
  }

  // Check if the timer should restart now that override is off
  // Requires knowing if YouTube tab is active/visible
  const tabData = await chrome.storage.local.get([
    "activeTabId",
    "isYouTubeVisible",
    "isYouTubeTab",
  ]);
  timerState.activeTabId = tabData.activeTabId ?? timerState.activeTabId;
  timerState.isYouTubeVisible =
    tabData.isYouTubeVisible ?? timerState.isYouTubeVisible;
  timerState.isYouTubeTab = tabData.isYouTubeTab ?? timerState.isYouTubeTab;

  if (
    timerState.isYouTubeTab &&
    timerState.isYouTubeVisible &&
    !timerState.isPaused
  ) {
    console.log("Restarting timer after override ended.");
    startTimer();
  }
}

async function initializeExtensionState() {
  console.log("Initializing extension state...");

  // --- Clear existing alarms on startup --- //
  await chrome.alarms.clear("timerTickAlarm");
  await chrome.alarms.clear(timerState.overrideAlarmName);
  console.log("Cleared any existing timer or override alarms.");

  // Load all necessary settings from storage in one go
  const data = await chrome.storage.local.get([
    "dailyLimits",
    "pauseOnMinimize",
    "remainingTime",
    "resetTime",
    "alarmTimestamp",
    "timeTracking",
    "lastTrackedDate",
    "isPaused",
    "activeTabId",
    "isYouTubeTab",
    "isYouTubeVisible",
  ]);

  // Set up tracking reset alarm for midnight
  setupTrackingResetAlarm();

  const day = new Date().toLocaleString("en-US", { weekday: "long" });
  const defaultDailyLimits = {
    Monday: 30,
    Tuesday: 30,
    Wednesday: 30,
    Thursday: 30,
    Friday: 30,
    Saturday: 30,
    Sunday: 30,
  };
  const defaultTimeTracking = {
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

  const dailyLimits = data.dailyLimits || defaultDailyLimits;
  const dailyLimit = dailyLimits[day] || 30; // Use default 30 if specific day is missing
  const resetTime = data.resetTime || "00:00";

  // --- Initialize Timer State --- //
  timerState.pauseOnMinimize = data.pauseOnMinimize ?? true;
  if (data.remainingTime !== undefined) {
    timerState.remainingTime = data.remainingTime;
  } else {
    timerState.remainingTime = dailyLimit * 60; // Default based on today's limit
    chrome.storage.local.set({ remainingTime: timerState.remainingTime }); // Save if defaulted
  }
  // Load persisted state for pause
  timerState.isPaused = data.isPaused ?? false;
  // *** Reset override state on initialization ***
  timerState.isOverrideActive = false;
  chrome.storage.local.set({ isOverrideActive: false }); // Ensure storage reflects reset state

  timerState.activeTabId = data.activeTabId || null;
  timerState.isYouTubeTab = data.isYouTubeTab ?? false;
  timerState.isYouTubeVisible = data.isYouTubeVisible ?? false;

  // --- Log State After Load --- //
  console.log(
    `[Init] State after loading/defaulting: remainingTime = ${timerState.remainingTime}, isPaused = ${timerState.isPaused}, isOverrideActive = ${timerState.isOverrideActive}`
  );

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

  // Perform daily tracking reset check (this returns a promise)
  await resetDailyTracking();
  console.log("Daily tracking check complete.");

  // --- Check if Timer Should Be Running On Startup --- //
  console.log(
    `Startup check: time=${timerState.remainingTime}, paused=${timerState.isPaused}, override=${timerState.isOverrideActive}, isYT=${timerState.isYouTubeTab}, isVisible=${timerState.isYouTubeVisible}`
  );
  if (
    timerState.remainingTime > 0 &&
    !timerState.isPaused &&
    !timerState.isOverrideActive &&
    timerState.isYouTubeTab &&
    timerState.isYouTubeVisible
  ) {
    console.log("Conditions met to start timer on initialization.");
    startTimer(); // This will create the timerTickAlarm
  } else {
    console.log("Conditions not met to start timer on initialization.");
  }

  // Clear potentially stale flags from storage (ensure state object is source of truth)
  // We still read them on init, but maybe don't need to remove?
  // chrome.storage.local.remove(["isPaused", "isOverrideActive"]); -> Keep for now for init logic

  console.log("Extension state initialized.", { timerState, trackingState });
}

// Initialize the extension state whenever the background script starts
// This covers browser startup, extension update, and manual enable.
initializeExtensionState();

// Listen for changes in chrome storage
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local") {
    // Check for pause state change
    if (changes.isPaused) {
      // Update the internal state if it changed externally (unlikely but possible)
      // No action needed usually, as internal state drives behavior.
      console.log("isPaused changed in storage:", changes.isPaused.newValue);
      timerState.isPaused = changes.isPaused.newValue;
    }

    // Check for override state change (e.g., from blocking page)
    if (changes.isOverrideActive) {
      // Update internal state if it changed externally
      console.log(
        "isOverrideActive changed in storage:",
        changes.isOverrideActive.newValue
      );
      timerState.isOverrideActive = changes.isOverrideActive.newValue;
      // Potentially update UI or alarms if needed based on external change
      // For now, assuming activateOverride/handleOverrideEnd manage state correctly.
    }

    // Check if overrideLimit setting changed
    if (changes.overrideLimit) {
      console.log(
        "overrideLimit changed in storage to:",
        changes.overrideLimit.newValue
      );
      // If an override was active when the setting changed, cancel it.
      if (timerState.isOverrideActive) {
        console.log(
          "Override limit setting changed while override active. Cancelling current override."
        );
        await chrome.alarms.clear(timerState.overrideAlarmName); // Clear the override end alarm
        timerState.isOverrideActive = false; // Update state
        await chrome.storage.local.set({ isOverrideActive: false }); // Persist state

        // Now determine what should happen: redirect or restart timer?
        if (timerState.remainingTime <= 0) {
          console.log(
            "Override cancelled, time is zero. Redirecting to blocking page."
          );
          redirectToBlockingPage();
        } else if (
          !timerState.isPaused &&
          timerState.isYouTubeTab &&
          timerState.isYouTubeVisible
        ) {
          // If timer should be running now override is off
          console.log(
            "Override cancelled, timer should be running. Starting timer."
          );
          startTimer(); // This will recreate the timerTickAlarm if needed
        } else {
          console.log(
            "Override cancelled, conditions not met to restart timer."
          );
        }
      }
    }

    // You might add listeners for other settings changes here if needed
    // e.g., resetTime, dailyLimits, pauseOnMinimize
  }
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  const isMinimized = windowId === chrome.windows.WINDOW_ID_NONE;
  timerState.isWindowMinimized = isMinimized;
  
  console.log(`Window focus changed. Minimized: ${isMinimized}`);

  // When window is unminimized, check if we should resume the timer
  if (!isMinimized && timerState.isYouTubeTab && timerState.isYouTubeVisible) {
    console.log("Window unminimized with visible YouTube tab, resuming timer...");
    timerState.isPaused = false;
    chrome.storage.local.set({ isPaused: false });
    startTimer();
  } else if (isMinimized && timerState.pauseOnMinimize) {
    console.log("Window minimized, pausing timer...");
    timerState.isPaused = true;
    chrome.storage.local.set({ isPaused: true });
    stopTimer();
  }
});

// Function to update tab visibility considering both document visibility and window state
function updateTabVisibility() {
  const isVisible = !timerState.isWindowMinimized && timerState.isYouTubeVisible;
  
  if (timerState.isYouTubeTab) {
    if (isVisible && !timerState.isPaused) {
      console.log("Tab is visible and not paused, starting timer...");
      startTimer();
    } else if (!isVisible && timerState.pauseOnMinimize) {
      console.log("Tab is not visible and pauseOnMinimize is true, stopping timer...");
      stopTimer();
    }
  }
}

// Update the existing handleVisibilityChange function to consider window state
function handleVisibilityChange(isVisible) {
  timerState.isYouTubeVisible = isVisible;

  // If window is minimized, force isVisible to false
  if (timerState.isWindowMinimized) {
    timerState.isYouTubeVisible = false;
  }

  // Update pause state based on visibility if pauseOnMinimize is enabled
  if (timerState.pauseOnMinimize) {
    timerState.isPaused = !timerState.isYouTubeVisible;
  }

  // Notify content script of the current state
  if (timerState.activeTabId) {
    chrome.tabs
      .sendMessage(timerState.activeTabId, {
        action: "visibilityStateUpdate",
        isVisible: timerState.isYouTubeVisible,
        isPaused: timerState.isPaused,
      })
      .catch((err) =>
        console.log("Error sending visibility update to content script:", err)
      );
  }
}

// --- Function to schedule tracking reset at midnight --- //
function setupTrackingResetAlarm() {
  // Clear any existing tracking reset alarm
  chrome.alarms.clear("trackingResetAlarm", () => {
    const now = new Date();
    // Set alarm for next midnight
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    
    chrome.alarms.create("trackingResetAlarm", {
      when: midnight.getTime(),
      periodInMinutes: 1440 // Repeat daily
    });
    console.log("Tracking reset alarm set for:", midnight);
  });
}
