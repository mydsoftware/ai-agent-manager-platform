(function () {
  var stored = null;
  try { stored = localStorage.getItem('aam_api_base'); } catch (e) {}
  if (window.AAM_API_BASE && window.AAM_API_BASE !== '/api') return;
  var isPages = location.hostname.indexOf('.github.io') !== -1 || location.hostname === 'mydsoftware.github.io';
  var remoteDefault = 'https://ai-agent-manager-platform.onrender.com/api';
  window.AAM_API_BASE = stored || (isPages ? remoteDefault : '/api');
})();
