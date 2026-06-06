chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.sync.set({
      apiBaseUrl: 'https://steam-dealx.onrender.com',
      region: 'br',
      enabled: true,
    });
  }
});
