/**
 * GitHub Pages — NO secrets
 */
(function () {
  var DEFAULT =
    "https://ai-agent-manager-platform.onrender.com/api";
  var stored = null;
  try {
    stored = localStorage.getItem("API_URL");
    // Drop dead Vercel URL if still cached
    if (stored && stored.indexOf("vercel.app") !== -1) {
      localStorage.removeItem("API_URL");
      stored = null;
    }
  } catch (e) {}
  window.AAM_CONFIG = {
    API_URL: stored || DEFAULT,
    APP_NAME: "AI Agent Manager",
    PAGES_BASE: "/ai-agent-manager-platform/",
  };
})();
