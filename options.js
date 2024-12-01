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

  document.getElementById("settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const dailyLimits = {};
    for (let [key, value] of formData.entries()) {
      if (["reset-time", "pause-on-minimize", "override-limit"].includes(key))
        continue;
      dailyLimits[key] = parseInt(value);
    }
    chrome.storage.local.set({
      dailyLimits,
      resetTime: formData.get("reset-time"),
      pauseOnMinimize: formData.get("pause-on-minimize") === "on",
      overrideLimit: parseInt(formData.get("override-limit")),
    });
    chrome.runtime.sendMessage({ action: "resetTimer" });
  });
});

document.getElementById("show-timer").addEventListener("change", (e) => {
  chrome.storage.local.set({ showTimer: e.target.checked });
});
