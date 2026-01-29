(function() {
  const DEFAULT_NEW_TAB_URL = 'https://www.google.com/';
  chrome.storage.local.get('newTabUrl', function(data) {
    let url = (data && data.newTabUrl && data.newTabUrl.trim()) ? data.newTabUrl.trim() : DEFAULT_NEW_TAB_URL;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    window.location.replace(url);
  });
})();
