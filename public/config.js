(function () {
  var stored = null;
  try { stored = localStorage.getItem('aam_api_base'); } catch (e) {}
  if (window.AAM_API_BASE && window.AAM_API_BASE !== '/api') return;
  window.AAM_API_BASE = stored || '/api';
})();
