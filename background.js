chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.sync.set({
      apiBaseUrl: 'https://steam-dealx.fly.dev',
      region: 'br',
      enabled: true,
    });
  }
});
