/**
 * GitHub Pages — NO secrets
 * After Render deploy, set API_URL to https://YOUR.onrender.com/api
 */
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem("API_URL");
  } catch (e) {}
  window.AAM_CONFIG = {
    API_URL:
      stored ||
      "https://ai-agent-manager-api.onrender.com/api",
    APP_NAME: "AI Agent Manager",
    PAGES_BASE: "/ai-agent-manager-platform/",
  };
})();
