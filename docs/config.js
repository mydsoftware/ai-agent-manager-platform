/**
 * GitHub Pages frontend — NO secrets
 * After Render deploy: set API_URL to https://YOUR-SERVICE.onrender.com/api
 */
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem("API_URL");
  } catch (e) {}
  window.AAM_CONFIG = {
    API_URL:
      stored ||
      "https://ai-agent-manager-platform-five.vercel.app/api",
    APP_NAME: "AI Agent Manager",
    PAGES_BASE: "/ai-agent-manager-platform/",
  };
})();
