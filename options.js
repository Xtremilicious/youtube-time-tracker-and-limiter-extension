document.addEventListener("DOMContentLoaded", () => {
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

      days.forEach((day) => {
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
        document.getElementById("daily-limits").appendChild(container);
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
  });
});
