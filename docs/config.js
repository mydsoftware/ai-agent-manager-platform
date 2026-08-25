/**
 * GitHub Pages — NO secrets
 * API on Render
 */
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem("API_URL");
  } catch (e) {}
  window.AAM_CONFIG = {
    API_URL:
      stored ||
      "https://ai-agent-manager-platform.onrender.com/api",
    APP_NAME: "AI Agent Manager",
    PAGES_BASE: "/ai-agent-manager-platform/",
  };
})();
