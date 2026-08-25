/**
 * GitHub Pages frontend config
 * Backend is separate. No secrets here.
 */
window.AAM_CONFIG = {
  API_URL:
    localStorage.getItem('API_URL') ||
    'https://ai-agent-manager-platform-five.vercel.app/api',
  APP_NAME: 'AI Agent Manager',
};
