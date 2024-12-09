/*
 * YouTube Time Tracker and Limiter
 * This is unimplemented.
 */

// content.js

// Function to inject the CSS styles
function injectCSS() {
  const styles = `
      #time-tracker-widget {
        margin-top: 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
  
      .time-tracker-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background: rgba(0, 0, 0, 0.13);
        border-radius: 7px;
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(4.8px);
        -webkit-backdrop-filter: blur(4.8px);
      }
  
      .time-tracker-context,
      .time-tracker-metric {
        display: flex;
        flex-direction: column;
        gap: 5px;
        justify-content: center;
        align-items: flex-start;
      }
  
      .time-tracker-metric {
        align-items: flex-end;
      }
  
      .time-tracker-context-title {
        font-size: 1rem;
        font-family: "Roboto", sans-serif;
        font-weight: 500;
        color: whitesmoke;
      }
  
      .time-tracker-context-subtitle {
        font-size: 0.8rem;
        color: #919193;
      }
  
      .time-tracker-metric-title {
        font-size: 1rem;
        font-family: "Roboto", sans-serif;
        font-weight: 300;
        color: whitesmoke;
      }
  
      .time-tracker-metric-subtitle {
        font-family: "Roboto", sans-serif;
        font-size: 0.9rem;
        color: #919193;
        display: flex;
        gap: 5px;
      }
  
      .metric-positive {
        color: #80c894;
      }
  
      .metric-negative {
        color: #ff0033;
      }
    `;

  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;

  // Load local Bootstrap Icons CSS from the extension's directory
  const bootstrapIcons = document.createElement("link");
  bootstrapIcons.rel = "stylesheet";
  bootstrapIcons.href = chrome.runtime.getURL("assets/css/bootstrap-icon.css"); // Using chrome.runtime.getURL() to get the correct path

  // Load local fonts CSS from the extension's directory
  const fonts = document.createElement("link");
  fonts.rel = "stylesheet";
  fonts.href = chrome.runtime.getURL("assets/css/fonts.css"); // Using chrome.runtime.getURL() to get the correct path

  // Append the styles and links to the document's head
  document.head.appendChild(styleSheet);
  document.head.appendChild(bootstrapIcons);
  document.head.appendChild(fonts);
}

// Function to create the widget element
function createTimeTrackerWidget() {
  const widget = document.createElement("div");
  widget.id = "time-tracker-widget";
  widget.style.position = "absolute";
  widget.style.top = "10px"; // Adjust position as needed
  widget.style.right = "10px";
  widget.style.zIndex = "9999";
  widget.style.display = "none"; // Initially hidden, will be shown on hover

  const widgetHTML = `
    <div class="time-tracker-section">
      <div class="time-tracker-context">
        <div class="time-tracker-context-title">Today</div>
        <div class="time-tracker-context-subtitle">vs. Last Active Day</div>
      </div>
      <div class="time-tracker-metric">
        <div class="time-tracker-metric-title" id="time-tracker-day-time">1hr 2 mins</div>
        <div class="time-tracker-metric-subtitle" id="time-tracker-day-change">
          <span>+69%</span><span><i class="material-icons">arrow_upward</i></span>
        </div>
      </div>
    </div>
    <div class="time-tracker-section">
      <div class="time-tracker-context">
        <div class="time-tracker-context-title">This week</div>
        <div class="time-tracker-context-subtitle">vs. Last Week</div>
      </div>
      <div class="time-tracker-metric">
        <div class="time-tracker-metric-title" id="time-tracker-week-time">1hr 2 mins</div>
        <div class="time-tracker-metric-subtitle" id="time-tracker-week-change">
          <span>+69%</span><span><i class="material-icons">arrow_upward</i></span>
        </div>
      </div>
    </div>
    <div class="time-tracker-section">
      <div class="time-tracker-context">
        <div class="time-tracker-context-title">This month</div>
        <div class="time-tracker-context-subtitle">vs. Last Month</div>
      </div>
      <div class="time-tracker-metric">
        <div class="time-tracker-metric-title" id="time-tracker-month-time">1hr 2 mins</div>
        <div class="time-tracker-metric-subtitle" id="time-tracker-month-change">
          <span>+69%</span><span><i class="material-icons">arrow_upward</i></span>
        </div>
      </div>
    </div>
    <div class="time-tracker-section">
      <div class="time-tracker-context">
        <div class="time-tracker-context-title">This year</div>
        <div class="time-tracker-context-subtitle">vs. Last Year</div>
      </div>
      <div class="time-tracker-metric">
        <div class="time-tracker-metric-title" id="time-tracker-year-time">1hr 2 mins</div>
        <div class="time-tracker-metric-subtitle" id="time-tracker-year-change">
          <span>+69%</span><span><i class="material-icons">arrow_upward</i></span>
        </div>
      </div>
    </div>
  `;

  // Parse the HTML string using DOMParser
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(widgetHTML, "text/html");

  // Append the parsed content to the widget
  Array.from(parsedDocument.body.childNodes).forEach((node) => {
    widget.appendChild(node);
  });

  return widget;
}

// Create a hoverable icon in the header using YouTube's Material Design icons
function createHoverIcon() {
  const hoverIcon = document.createElement("div");
  hoverIcon.classList.add("material-icons");
  hoverIcon.innerText = "access_time"; // Material icon for "access time" (clock icon)
  hoverIcon.style.cursor = "pointer";
  hoverIcon.style.fontSize = "30px";
  hoverIcon.style.color = "#fff";
  hoverIcon.style.zIndex = "9999";
  hoverIcon.addEventListener("mouseover", () => {
    document.getElementById("time-tracker-widget").style.display = "block";
  });
  hoverIcon.addEventListener("mouseout", () => {
    document.getElementById("time-tracker-widget").style.display = "none";
  });

  return hoverIcon;
}

// Insert the widget and hover icon after the logo
function insertWidget() {
  console.log("Inserting time tracker widget...");
  const ytIcon = document.getElementById("logo");
  if (ytIcon) {
    const widget = createTimeTrackerWidget();
    const hoverIcon = createHoverIcon();
    console.log(ytIcon);
    // Insert the widget after the logo
    ytIcon.parentNode.insertBefore(hoverIcon, ytIcon.nextSibling);
    ytIcon.parentNode.insertBefore(widget, ytIcon.nextSibling);
  }
}

// Wait for the DOM to be fully loaded
window.addEventListener("DOMContentLoaded", () => {
  injectCSS(); // Inject the CSS styles
  insertWidget();
});

injectCSS();
insertWidget();
