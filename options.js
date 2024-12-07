document.addEventListener("DOMContentLoaded", () => {
  // Function to display the toast
  function showToast(message) {
    if (document.getElementById("toast"))
      document.getElementById("toast").remove();
    const toast = document.createElement("div");
    toast.id = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast with animation
    setTimeout(() => {
      toast.style.display = "block";
      toast.style.opacity = 1;
    }, 100);

    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.style.opacity = 0;
      setTimeout(() => toast.remove(), 500); // Remove after fade out
    }, 3000);
  }

  chrome.storage.local.get(
    ["dailyLimits", "resetTime", "pauseOnMinimize", "overrideLimit"],
    (data) => {
      document.getElementById("reset-time").value = data.resetTime || "00:00";
      document.getElementById("pause-on-minimize").checked =
        data.pauseOnMinimize || false;
      document.getElementById("override-limit").value =
        data.overrideLimit || 10;

      const dailyLimits = data.dailyLimits || {};
      const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];

      days.forEach((day, index) => {
        // Create the label element
        const label = document.createElement("label");
        label.textContent = day;

        // Create the input element for daily limits
        const input = document.createElement("input");
        input.type = "number";
        input.name = day;
        input.placeholder = `Limit for ${day}`;
        input.value = dailyLimits[day] || 0;

        // Append the label and input to the daily-limits container
        const container = document.createElement("div");
        container.appendChild(label);
        container.appendChild(input);
        container.style.width = "45%";
        if (index != days.length - 1) {
          container.style.marginBottom = "1rem";
        }
        // Get the reference element (save-override-limit button)
        const saveButton = document.getElementById(
          "save-daily-limits-container"
        );
        document
          .getElementById("daily-limits")
          .insertBefore(container, saveButton);
      });
    }
  );

  document.getElementById("save-reset-time").addEventListener("click", () => {
    const resetTime = document.getElementById("reset-time").value;
    chrome.storage.local.set({ resetTime });
    chrome.runtime.sendMessage({
      action: "saveResetTime",
      newResetTime: resetTime,
    });
    console.log("Reset Time saved:", resetTime);
    showToast(`Reset Time saved: ${resetTime}`);
  });

  // Pause on Minimize Change Handler
  document
    .getElementById("pause-on-minimize")
    .addEventListener("change", (e) => {
      chrome.storage.local.set({ pauseOnMinimize: e.target.checked });
      chrome.runtime.sendMessage({
        action: "savePauseOnMinimize",
        pauseState: e.target.checked,
      });
    });

  document
    .getElementById("save-override-limit")
    .addEventListener("click", () => {
      const overrideLimit = parseInt(
        document.getElementById("override-limit").value
      );
      chrome.storage.local.set({ overrideLimit });
      chrome.runtime.sendMessage({ action: "saveOverrideLimit" });
      console.log("Override Limit saved:", overrideLimit);
      showToast(`Override Limit saved: ${overrideLimit} minutes`);
    });

  document.getElementById("save-daily-limits").addEventListener("click", () => {
    const dailyLimits = {};
    const dailyLimitInputs = document.querySelectorAll("#daily-limits input");
    dailyLimitInputs.forEach((input) => {
      dailyLimits[input.name] = parseInt(input.value);
    });
    chrome.storage.local.set({ dailyLimits });
    chrome.runtime.sendMessage({ action: "saveDailyLimit" });
    console.log("Daily Limits saved:", dailyLimits);
    showToast(`Daily Limits saved`);
  });
});
