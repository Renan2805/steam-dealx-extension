const DEFAULTS = { apiBaseUrl: 'https://steam-dealx.fly.dev', region: 'br', enabled: true };

document.addEventListener('DOMContentLoaded', () => {
  const toggleEl  = document.getElementById('toggle');
  const regionEl  = document.getElementById('region');
  const apiUrlEl  = document.getElementById('apiBaseUrl');
  const saveBtn   = document.getElementById('save');
  const savedMsg  = document.getElementById('saved-msg');

  chrome.storage.sync.get(DEFAULTS, (settings) => {
    toggleEl.checked = settings.enabled;
    regionEl.value   = settings.region;
    apiUrlEl.value   = settings.apiBaseUrl;
  });

  // Toggle salva imediatamente para resposta rápida
  toggleEl.addEventListener('change', () => {
    chrome.storage.sync.set({ enabled: toggleEl.checked });
  });

  saveBtn.addEventListener('click', () => {
    const urlStr = apiUrlEl.value.trim();

    if (urlStr) {
      try {
        new URL(urlStr);
      } catch {
        apiUrlEl.setCustomValidity('URL inválida');
        apiUrlEl.reportValidity();
        return;
      }
    }
    apiUrlEl.setCustomValidity('');

    chrome.storage.sync.set(
      { enabled: toggleEl.checked, region: regionEl.value, apiBaseUrl: urlStr },
      () => {
        savedMsg.hidden = false;
        setTimeout(() => { savedMsg.hidden = true; }, 1500);
      },
    );
  });
});
