let remainingTime = 0;
let activeTabId = null;
let isOverrideActive = false;
let pauseOnMinimize = false;
let isPaused = false;
let timerInterval = null;
let overrideSetTimout = null;
let isYouTubeTab = false; // Track if the active tab is YouTube
// Flag to track if YouTube is in focus
let isYouTubeVisible = false;

// Load settings from storage and set defaults if needed
function loadSettings(callback) {
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
    pauseOnMinimize: true,
    overrideLimit: 10,
  };

  chrome.storage.local.get(defaultSettings, (data) => {
    chrome.storage.local.set(defaultSettings, () => {
      console.log("Default settings saved to storage");
    });

    const day = new Date().toLocaleString("en-US", { weekday: "long" });
    const dailyLimit = data.dailyLimits[day] || 0;
    remainingTime = dailyLimit * 60; // Convert minutes to seconds

    pauseOnMinimize = data.pauseOnMinimize || true;
    updateBadge();

    if (callback) callback(data);
  });
}

function updateBadge() {
  let badgeText;

  if (remainingTime >= 3600) {
    // 1 hour or more
    const hours = Math.floor(remainingTime / 3600);
    badgeText = `${hours}h`;
  } else if (remainingTime >= 60) {
    // 1 minute or more
    const minutes = Math.floor(remainingTime / 60);
    badgeText = `${minutes}m`;
  } else {
    // Less than 1 minute
    badgeText = `${remainingTime}s`;
  }

  chrome.browserAction.setBadgeBackgroundColor({ color: "#ff0033" });
  chrome.browserAction.setBadgeText({ text: badgeText });
}

// Start the countdown
function startTimer() {
  if (timerInterval) {
    console.log("Timer already running");
    return;
  }

  console.log("Starting the timer");
  timerInterval = setInterval(() => {
    if (remainingTime > 0 && !isOverrideActive && !isPaused) {
      remainingTime--;
      updateBadge();
    } else if (remainingTime === 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      notifyTimeUp();
      redirectToBlockingPage();
    }
  }, 1000);
}

// Redirect the current tab to a blocking page
function redirectToBlockingPage() {
  const blockingPageURL = chrome.runtime.getURL("times-up.html");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab && activeTab.url && activeTab.url.includes("youtube.com")) {
      chrome.tabs.update(activeTab.id, { url: blockingPageURL });
    }
  });
}

// Stop the timer
function stopTimer() {
  if (isPaused) {
    console.log("Timer already paused");
    return;
  }
  clearInterval(timerInterval);
  timerInterval = null;
  console.log("Timer stopped");
}

// Show a notification when time is up
function notifyTimeUp() {
  chrome.notifications.create({
    title: "YouTube Time Limit Reached",
    message: "Your daily YouTube time is up!",
    iconUrl: "icon.png",
    type: "basic",
  });
}

// Reset timer each day at the configured reset time
function resetTimer() {
  const day = new Date().toLocaleString("en-US", { weekday: "long" });
  chrome.storage.local.get("dailyLimits", (data) => {
    const dailyLimits = data.dailyLimits || {};
    const dailyLimit = dailyLimits[day] || 0;
    remainingTime = dailyLimit * 60;
    updateBadge();
    overrideSetTimout = null;
    isOverrideActive = false;
  });
}

// // Handle when a window loses or gains focus
// chrome.windows.onFocusChanged.addListener((windowId) => {
//   if (windowId === chrome.windows.WINDOW_ID_NONE) {
//     // Window is minimized
//     console.log("Window minimized. Pausing timer...");
//     isYouTubeInFocus = false;
//     stopTimer();
//   } else {
//     // Window regained focus
//     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//       const activeTab = tabs[0];
//       if (activeTab && activeTab.url && activeTab.url.includes("youtube.com")) {
//         console.log("YouTube tab regained focus. Resuming timer...");
//         isYouTubeInFocus = true;
//         startTimer();
//       }
//     });
//   }
// });

// Handle when a tab is activated (switching between tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  activeTabId = activeInfo.tabId;
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && tab.url.includes("youtube.com")) {
      console.log("YouTube tab activated.");
      startTimer();
    } else {
      console.log("Non-YouTube tab activated. Stopping timer...");
      stopTimer();
    }
  });
});

// Detect when a tab's visibility changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("youtube.com")
  ) {
    chrome.windows.getCurrent((window) => {
      if (window.focused) {
        console.log("YouTube is visible. Resuming timer...");
        isYouTubeInFocus = true;
        startTimer();
      }
    });
  }
});

// Reset the timer every day (via alarm)
chrome.alarms.create("resetTimer", { when: Date.now(), periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "resetTimer") resetTimer();
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "pauseTimer") {
    console.log("Pausing timer...");
    isPaused = true;
  }

  if (message.action === "resumeTimer") {
    console.log("Resuming timer...");
    isPaused = false;
  }

  if (message.action === "resetTimer") {
    console.log("Resetting timer...");
    resetTimer();
  }

  if (message.action === "getRemainingTime") {
    sendResponse({ time: remainingTime });
  }

  if (message.action === "activateOverride") {
    isOverrideActive = true;
    overrideSetTimout = setTimeout(() => {
      isOverrideActive = false;
    }, 10 * 60 * 1000); // Override lasts 10 minutes
  }

  if (message.action === "updateVisibility") {
    if (!pauseOnMinimize) return;
    const { isVisible } = message; // Include tabId in the message
    isYouTubeVisible = isVisible;

    console.log(
      `YouTube visibility updated for tab ${sender.tab.id}: ${isYouTubeVisible}`
    );

    if (sender.tab.id === activeTabId) {
      // Only affect the active tab's timer
      if (isYouTubeVisible) {
        console.log("This YouTube tab is visible. Resuming timer...");
        startTimer();
      } else {
        console.log("This YouTube tab is not visible. Pausing timer...");
        stopTimer();
      }
    }
  }

  return true;
});

// Initialize settings on installation and extension startup
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
  loadSettings();
});
