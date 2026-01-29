// Popup script - toggle sidebar visibility when extension icon is clicked
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, { 
      type: 'TOGGLE_SIDEBAR' 
    }).catch(() => {
      // Ignore errors - tab might not have content script
    });
    window.close();
  }
});
