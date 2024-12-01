// function handleVisibilityChange() {
//   const isVisible =
//     document.visibilityState === "visible" && document.hidden !== true;
//   chrome.runtime.sendMessage({ action: "updateVisibility", isVisible });
// }

// // Listen for visibility changes
// document.addEventListener("visibilitychange", handleVisibilityChange);

// // Notify the background script of the initial visibility state
// chrome.runtime.sendMessage({
//   action: "updateVisibility",
//   isVisible: document.visibilityState === "visible",
// });

function handleVisibilityChange() {
  const isVisible =
    document.visibilityState === "visible" && document.hidden !== true;

  // Send tabId along with the visibility state
  chrome.runtime.sendMessage({
    action: "updateVisibility",
    isVisible, // Using tabId to track the active tab
  });
}

// Listen for visibility changes
document.addEventListener("visibilitychange", handleVisibilityChange);

// Notify the background script of the initial visibility state
chrome.runtime.sendMessage({
  action: "updateVisibility",
  isVisible: document.visibilityState === "visible" && document.hidden !== true,
});

// chrome.storage.local.get(["showTimer"], (data) => {
//   if (data.showTimer) {
//     addHoveringTimer();
//   }
// });

// document.getElementById("show-timer").addEventListener("change", (e) => {
//   chrome.storage.local.set({ showTimer: e.target.checked });
//   if (e.target.checked) {
//     addHoveringTimer();
//   } else {
//     removeHoveringTimer();
//   }
// });

function addHoveringTimer() {
  const timer = document.createElement("div");
  timer.id = "floating-timer";
  timer.style.position = "fixed";
  timer.style.top = "10px";
  timer.style.right = "10px";
  timer.style.padding = "5px 10px";
  timer.style.backgroundColor = "#282828"; // YouTube dark background
  timer.style.color = "#fff"; // White text for contrast
  timer.style.borderRadius = "5px";
  timer.style.zIndex = "9999";
  timer.style.cursor = "move"; // Cursor to indicate drag
  document.body.appendChild(timer);

  // Create dismiss icon
  const dismissIcon = document.createElement("span");
  dismissIcon.textContent = "×"; // Using the multiplication sign as the close icon
  dismissIcon.style.position = "absolute";
  dismissIcon.style.top = "5px";
  dismissIcon.style.right = "5px";
  dismissIcon.style.fontSize = "18px";
  dismissIcon.style.cursor = "pointer";
  dismissIcon.style.color = "#fff";
  dismissIcon.style.zIndex = "19999";
  timer.appendChild(dismissIcon);

  // Add event listener for dismiss icon
  dismissIcon.addEventListener("click", () => {
    timer.remove(); // Remove the timer when the icon is clicked
  });
  // Draggable logic
  let offsetX, offsetY;

  timer.addEventListener("mousedown", (e) => {
    offsetX = e.clientX - timer.getBoundingClientRect().left;
    offsetY = e.clientY - timer.getBoundingClientRect().top;
    document.addEventListener("mousemove", moveTimer);
    document.addEventListener("mouseup", () => {
      document.removeEventListener("mousemove", moveTimer);
    });
  });

  function moveTimer(e) {
    const newLeft = e.clientX - offsetX;
    const newTop = e.clientY - offsetY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Keep the timer within the viewport horizontally
    if (newLeft >= 0 && newLeft <= viewportWidth - timer.offsetWidth) {
      timer.style.left = `${newLeft}px`;
      timer.style.right = "auto"; // Disable right positioning when dragging left
    }

    // Keep the timer within the viewport vertically
    if (newTop >= 0 && newTop <= viewportHeight - timer.offsetHeight) {
      timer.style.top = `${newTop}px`;
    }
  }

  setInterval(function () {
    chrome.runtime.sendMessage({ action: "getRemainingTime" }, (response) => {
      if (response && response.time) {
        timer.textContent = formatTime(response.time);
      } else {
        timer.textContent = "Error";
      }
    });
  }, 1000);
}

function removeHoveringTimer() {
  const timer = document.getElementById("floating-timer");
  if (timer) {
    timer.remove();
  }
}

function formatTime(timeInSeconds) {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
