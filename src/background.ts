// Service Worker for Chrome Extension
// Handles side panel events, workspace tab management, and browser close behavior

import { StorageService, Workspace } from './storage';

console.log('Background service worker initialized');

// Initialize side panel when extension is first loaded
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');
  
  // Set up side panel
  chrome.sidePanel.setOptions({
    path: 'dist/sidepanel.html',
    enabled: true
  });

  // Initialize default workspace if needed
  await StorageService.getWorkspaceData();
});

// Listen for side panel changes
chrome.sidePanel.onPanelOpened?.addListener(() => {
  console.log('Side panel opened');
});

// Handle browser close - save tabs for each workspace
chrome.runtime.onSuspend?.addListener(async () => {
  console.log('Extension suspending - saving workspace tabs');
  await saveAllWorkspaceTabs();
});

// Also listen for browser close via tabs API
chrome.tabs.onRemoved.addListener(async () => {
  // Debounce this to avoid too many writes
  setTimeout(async () => {
    await saveAllWorkspaceTabs();
  }, 1000);
});

// Save tabs for current workspace (only the last-focused window so we don't mix windows)
async function saveAllWorkspaceTabs(): Promise<void> {
  try {
    const data = await StorageService.getWorkspaceData();
    if (!data.currentWorkspaceId) return;
    const win = await chrome.windows.getLastFocused({ populate: false }).catch(() => null);
    const tabQuery = win?.id != null ? { windowId: win.id } : {};
    const tabs = await chrome.tabs.query(tabQuery);
    await StorageService.saveClosedTabs(data.currentWorkspaceId, tabs);
  } catch (error) {
    console.error('Error saving workspace tabs:', error);
  }
}

// Resolve window ID from sender (content script tab) or last-focused window
function resolveWindowId(sender: chrome.runtime.MessageSender): Promise<number> {
  if (sender.tab != null && sender.tab.windowId != null) {
    return Promise.resolve(sender.tab.windowId);
  }
  return chrome.windows.getLastFocused({ populate: false })
    .then(win => win?.id ?? 0)
    .catch(() => 0);
}

// Handle workspace switching - restore tabs if needed
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'switchWorkspace') {
    resolveWindowId(sender)
      .then((windowId) => handleWorkspaceSwitch(message.workspaceId, windowId))
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('Error switching workspace:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  // Content script needs current workspace ID when saving (add workspace/bookmark)
  if (message.type === 'getCurrentWorkspace') {
    StorageService.getWorkspaceData()
      .then((data) => sendResponse({ workspaceId: data.currentWorkspaceId }))
      .catch(() => sendResponse({ workspaceId: 'default' }));
    return true;
  }

  // Delete workspace (background is source of truth; then replace window tabs if deleted was current)
  if (message.type === 'deleteWorkspace') {
    const workspaceId = message.workspaceId as string;
    StorageService.getWorkspaceData()
      .then((data) => {
        if (!data.workspaces || data.workspaces.length <= 1) {
          sendResponse({ success: false, error: 'Cannot delete the last workspace' });
          return Promise.reject(new Error('abort'));
        }
        const wasCurrent = data.currentWorkspaceId === workspaceId;
        return StorageService.deleteWorkspace(workspaceId).then(() => wasCurrent);
      })
      .then((wasCurrent) => {
        if (!wasCurrent) return;
        return resolveWindowId(sender).then((windowId) =>
          StorageService.getWorkspaceData().then((newData) =>
            replaceWindowTabsWithWorkspaceTabs(newData.currentWorkspaceId, windowId)
          )
        );
      })
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => {
        if (err?.message !== 'abort') {
          console.error('Error deleting workspace:', err);
          sendResponse({ success: false, error: err?.message ?? 'Unknown error' });
        }
      });
    return true;
  }
});

async function handleWorkspaceSwitch(workspaceId: string, windowId?: number): Promise<void> {
  const tabQuery = windowId != null && windowId !== 0 ? { windowId } : {};

  const data = await StorageService.getWorkspaceData();
  const leavingWorkspaceId = data.currentWorkspaceId;

  // Single atomic write: save leaving workspace's tabs and set current (avoids races with content script)
  if (leavingWorkspaceId && leavingWorkspaceId !== workspaceId) {
    const allTabs = await chrome.tabs.query(tabQuery);
    const activeTab = allTabs.find(t => t.active);
    const activeTabUrl = activeTab?.url && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('chrome-extension://')
      ? activeTab.url
      : undefined;
    const closedTabs = allTabs
      .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
      .map(t => ({ url: t.url!, title: t.title }));
    const leaving = data.workspaces.find(w => w.id === leavingWorkspaceId);
    if (leaving) {
      leaving.closedTabs = closedTabs;
      leaving.activeTabUrl = activeTabUrl;
    }
  }
  data.currentWorkspaceId = workspaceId;
  data.workspaces.forEach(w => { w.active = w.id === workspaceId; });
  await StorageService.saveWorkspaceData(data);

  const workspace = data.workspaces.find(w => w.id === workspaceId);
  if (!workspace) return;

  const settings = workspace.settings ?? {};
  const onCloseBehavior = settings.onCloseBehavior ?? 'continue';
  const defaultTabs = settings.defaultTabs ?? [];

  // Always replace this window's tabs with the target workspace's environment (each workspace is its own environment)
  if (onCloseBehavior === 'default' && defaultTabs.length > 0) {
    // Workspace has default URLs: open those, then close current tabs
    const currentTabs = await chrome.tabs.query(tabQuery);
    const tabsToClose = currentTabs
      .filter(tab => tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://'))
      .map(tab => tab.id!);
    const existingUrls = new Set(currentTabs.map(tab => tab.url).filter(Boolean) as string[]);
    for (const url of defaultTabs) {
      if (!existingUrls.has(url)) {
        await chrome.tabs.create({ url, active: false, windowId });
        existingUrls.add(url);
      }
    }
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
    }
  } else {
    // Continue where left off (or empty): show this workspace's saved tabs, or one new tab if none saved
    await replaceWindowTabsWithWorkspaceTabs(workspaceId, windowId, workspace);
  }
}

/** Replace this window's tabs with the given workspace's saved tabs (or one new tab if workspace has none). */
async function replaceWindowTabsWithWorkspaceTabs(workspaceId: string, windowId?: number, workspaceFromMemory?: Workspace): Promise<void> {
  const tabQuery = windowId != null && windowId !== 0 ? { windowId } : {};
  const workspace = workspaceFromMemory ?? (await StorageService.getWorkspaceData()).workspaces.find(w => w.id === workspaceId);
  if (!workspace) return;

  const currentTabs = await chrome.tabs.query(tabQuery);
  const tabsToClose = currentTabs
    .filter(tab => tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://'))
    .map(tab => tab.id!);

  if (workspace.closedTabs && workspace.closedTabs.length > 0) {
    // Create workspace's saved tabs first, then close old tabs
    const existingUrls = new Set(currentTabs.map(tab => tab.url).filter(Boolean) as string[]);
    let created = 0;
    let activeTabId: number | undefined;
    for (const tab of workspace.closedTabs) {
      if (tab.url && !existingUrls.has(tab.url)) {
        const createdTab = await chrome.tabs.create({ url: tab.url, active: false, windowId });
        created++;
        if (tab.url === workspace.activeTabUrl) {
          activeTabId = createdTab.id;
        }
      }
    }
    // Only close old tabs if we created at least one new tab, so we never leave the window with 0 tabs
    if (tabsToClose.length > 0 && created > 0) {
      await chrome.tabs.remove(tabsToClose);
    }
    // Focus the tab that was last active in this workspace (so it's focused + loaded when switching back)
    if (activeTabId != null) {
      await chrome.tabs.update(activeTabId, { active: true });
      if (windowId != null) {
        await chrome.windows.update(windowId, { focused: true });
      }
    } else if (workspace.activeTabUrl && windowId != null) {
      // Active tab was already open (e.g. same URL); find it after close and focus
      const tabsInWindow = await chrome.tabs.query({ windowId });
      const tabToFocus = tabsInWindow.find(t => t.url === workspace.activeTabUrl);
      if (tabToFocus?.id) {
        await chrome.tabs.update(tabToFocus.id, { active: true });
        await chrome.windows.update(windowId, { focused: true });
      }
    }
  } else {
    // Workspace has no saved tabs: one new tab (newTabUrl or google.com), then close old
    const data = await chrome.storage.local.get('newTabUrl');
    const raw = (data?.newTabUrl != null && String(data.newTabUrl).trim()) ? String(data.newTabUrl).trim() : 'https://www.google.com/';
    const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    await chrome.tabs.create({ url, active: true, windowId });
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
    }
  }
}

async function restoreWorkspaceTabs(workspaceId: string, clearExisting: boolean = false, windowId?: number): Promise<void> {
  const workspace = (await StorageService.getWorkspaceData()).workspaces.find(w => w.id === workspaceId);
  if (!workspace || !workspace.closedTabs?.length) return;

  const tabQuery = windowId != null && windowId !== 0 ? { windowId } : {};
  const currentTabs = await chrome.tabs.query(tabQuery);

  if (clearExisting && currentTabs.length > 0) {
    const tabsToClose = currentTabs
      .filter(tab => tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://'))
      .map(tab => tab.id!);

    const existingUrls = new Set(currentTabs.map(tab => tab.url).filter(Boolean) as string[]);

    // Create new tabs FIRST so the window never has 0 tabs (avoids browser/window closing)
    let created = 0;
    for (const tab of workspace.closedTabs) {
      if (tab.url && !existingUrls.has(tab.url)) {
        await chrome.tabs.create({ url: tab.url, active: false, windowId });
        existingUrls.add(tab.url);
        created++;
      }
    }

    // Only close old tabs if we created at least one new one, so we never leave the window with 0 tabs
    if (tabsToClose.length > 0 && created > 0) {
      await chrome.tabs.remove(tabsToClose);
    }
  } else {
    const remainingTabs = await chrome.tabs.query(tabQuery);
    const existingUrls = new Set(remainingTabs.map(tab => tab.url).filter(Boolean) as string[]);
    for (const tab of workspace.closedTabs) {
      if (tab.url && !existingUrls.has(tab.url)) {
        await chrome.tabs.create({ url: tab.url, active: false, windowId });
        existingUrls.add(tab.url);
      }
    }
  }
}

// Handle extension startup - restore workspace state (only in the current window)
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension startup - restoring workspace state');
  try {
    const workspace = await StorageService.getCurrentWorkspace();
    const win = await chrome.windows.getCurrent({ populate: false });
    const windowId = win?.id;
    const currentTabs = windowId != null ? await chrome.tabs.query({ windowId }) : await chrome.tabs.query({});
    const settings = workspace.settings ?? {};
    const onCloseBehavior = settings.onCloseBehavior ?? 'continue';
    const defaultTabs = settings.defaultTabs ?? [];

    if (onCloseBehavior === 'continue' && workspace.closedTabs?.length > 0) {
      if (windowId != null) {
        await restoreWorkspaceTabs(workspace.id, true, windowId);
      } else {
        await restoreWorkspaceTabs(workspace.id, true);
      }
    } else if (onCloseBehavior === 'default' && defaultTabs.length > 0) {
      const existingUrls = new Set(currentTabs.map(tab => tab.url).filter(Boolean) as string[]);
      for (const url of defaultTabs) {
        if (!existingUrls.has(url)) {
          await chrome.tabs.create({ url, active: false, windowId });
          existingUrls.add(url);
        }
      }
    }
  } catch (error) {
    console.error('Error restoring workspace on startup:', error);
  }
});
