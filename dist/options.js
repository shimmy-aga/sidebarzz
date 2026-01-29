// Options page script
const DEFAULT_BOOKMARKS = [
  { id: '1', title: 'GitHub', url: 'https://github.com' },
  { id: '2', title: 'Stack Overflow', url: 'https://stackoverflow.com' },
  { id: '3', title: 'MDN', url: 'https://developer.mozilla.org' },
  { id: '4', title: 'Chrome DevTools', url: 'https://developer.chrome.com' }
];

const DEFAULT_WORKSPACES = [
  { id: 'default', name: 'Default' },
  { id: 'work', name: 'Work' }
];

// Load settings on page open
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
});

function loadSettings() {
  chrome.storage.local.get(['sidebarPosition', 'workspaces', 'bookmarks', 'workspaceData'], (data) => {
    // Load position
    const position = data.sidebarPosition || 'left';
    const positionEl = document.querySelector(`input[name="position"][value="${position}"]`);
    if (positionEl) positionEl.checked = true;

    // Load workspaces from workspaceData (source of truth) or fallback
    const workspaces = (data.workspaceData && data.workspaceData.workspaces && data.workspaceData.workspaces.length)
      ? data.workspaceData.workspaces
      : (data.workspaces || DEFAULT_WORKSPACES);
    renderWorkspaces(workspaces);

    // Load bookmarks
    const bookmarks = data.bookmarks || DEFAULT_BOOKMARKS;
    renderBookmarks(bookmarks);
  });
}

function renderWorkspaces(workspaces) {
  const container = document.getElementById('workspaces-list');
  container.innerHTML = '';

  workspaces.forEach(ws => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <input type="text" class="workspace-name" value="${ws.name}" placeholder="Workspace name">
      </div>
      <button class="btn btn-small btn-danger" onclick="deleteWorkspace('${ws.id}')">Delete</button>
    `;
    container.appendChild(item);
  });
}

function renderBookmarks(bookmarks) {
  const container = document.getElementById('bookmarks-list');
  container.innerHTML = '';

  bookmarks.forEach(bm => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <input type="text" class="bookmark-title" value="${bm.title}" placeholder="Title">
        <input type="url" class="bookmark-url" value="${bm.url}" placeholder="https://example.com">
      </div>
      <button class="btn btn-small btn-danger" onclick="deleteBookmark('${bm.id}')">Delete</button>
    `;
    container.appendChild(item);
  });
}

function setupEventListeners() {
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('reset-btn').addEventListener('click', resetToDefaults);
  document.getElementById('add-workspace-btn').addEventListener('click', addWorkspace);
  document.getElementById('add-bookmark-btn').addEventListener('click', addBookmark);
}

function saveSettings() {
  const position = document.querySelector('input[name="position"]:checked').value;

  const workspaces = Array.from(document.querySelectorAll('.workspace-name')).map((input, i) => ({
    id: `ws-${i}`,
    name: input.value
  }));

  const bookmarks = Array.from(document.querySelectorAll('.bookmark-url')).map((input, i) => ({
    id: `bm-${i}`,
    title: document.querySelectorAll('.bookmark-title')[i].value,
    url: input.value
  }));

  chrome.storage.local.set({
    sidebarPosition: position,
    workspaces,
    bookmarks
  }, () => {
    showStatus('Settings saved!', 'success');
    
    // Reload extension content
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'RELOAD_SIDEBAR',
          workspaces,
          bookmarks
        }).catch(() => {});
      });
    });
  });
}

function resetToDefaults() {
  if (confirm('Reset all settings to defaults?')) {
    chrome.storage.local.set({
      sidebarPosition: 'left',
      workspaces: DEFAULT_WORKSPACES,
      bookmarks: DEFAULT_BOOKMARKS
    }, () => {
      loadSettings();
      showStatus('Settings reset to defaults', 'success');
    });
  }
}

function addWorkspace() {
  const name = prompt('Enter workspace name:');
  if (name) {
    const container = document.getElementById('workspaces-list');
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <input type="text" class="workspace-name" value="${name}" placeholder="Workspace name">
      </div>
      <button class="btn btn-small btn-danger" onclick="this.parentElement.remove()">Delete</button>
    `;
    container.appendChild(item);
  }
}

function addBookmark() {
  const title = prompt('Enter bookmark title:');
  if (!title) return;
  
  const url = prompt('Enter bookmark URL:');
  if (!url) return;

  const container = document.getElementById('bookmarks-list');
  const item = document.createElement('div');
  item.className = 'list-item';
  item.innerHTML = `
    <div class="item-info">
      <input type="text" class="bookmark-title" value="${title}" placeholder="Title">
      <input type="url" class="bookmark-url" value="${url}" placeholder="https://example.com">
    </div>
    <button class="btn btn-small btn-danger" onclick="this.parentElement.remove()">Delete</button>
  `;
  container.appendChild(item);
}

function deleteWorkspace(id) {
  if (!confirm('Delete this workspace?')) return;
  chrome.storage.local.get('workspaceData', (data) => {
    let wd = data.workspaceData;
    if (!wd || !wd.workspaces || wd.workspaces.length <= 1) {
      alert('Cannot delete the last workspace');
      return;
    }
    wd.workspaces = wd.workspaces.filter((w) => w.id !== id);
    if (wd.currentWorkspaceId === id) {
      wd.currentWorkspaceId = wd.workspaces[0].id;
    }
    chrome.storage.local.set({ workspaceData: wd }, () => {
      loadSettings();
    });
  });
}

function deleteBookmark(id) {
  if (confirm('Delete this bookmark?')) {
    document.querySelector(`input[data-id="${id}"]`)?.parentElement.parentElement.remove();
  }
}

function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status-message status-${type}`;
  setTimeout(() => {
    statusEl.textContent = '';
  }, 3000);
}
