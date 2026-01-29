"use strict";
(() => {
  // src/storage.ts
  var DEFAULT_SETTINGS = {
    roundedCorners: true,
    marginFromSide: 0,
    marginTop: 0,
    marginBottom: 0,
    width: 52,
    // Default sidebar width (40-80px range)
    borderRadius: 0,
    // Default panel border radius
    iconBorderRadius: 25,
    // Default icon border radius (max)
    position: "left",
    alignment: "top",
    backgroundColor: "#252526",
    iconBackgroundColor: "#2d2d2d",
    iconTextColor: "#d4d4d4",
    borderColor: "#3e3e42",
    accentColor: "#007acc",
    mode: "fixed",
    collapsible: false,
    collapsed: false,
    onCloseBehavior: "continue",
    defaultTabs: [],
    iconPackId: "minimalist"
    // Default to minimalist icon pack
  };
  var StorageService = class {
    // Get all workspace data
    static async getWorkspaceData() {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      if (!result[this.STORAGE_KEY]) {
        const defaultData = {
          workspaces: [{
            id: "default",
            name: "Default",
            active: true,
            bookmarks: [],
            openTabs: [],
            closedTabs: [],
            settings: { ...DEFAULT_SETTINGS },
            createdAt: Date.now(),
            updatedAt: Date.now()
          }],
          currentWorkspaceId: "default"
        };
        await this.saveWorkspaceData(defaultData);
        return defaultData;
      }
      return result[this.STORAGE_KEY];
    }
    // Save all workspace data
    static async saveWorkspaceData(data) {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: data });
    }
    // Get current workspace
    static async getCurrentWorkspace() {
      const data = await this.getWorkspaceData();
      const workspace = data.workspaces.find((w) => w.id === data.currentWorkspaceId);
      if (!workspace) {
        throw new Error("Current workspace not found");
      }
      return workspace;
    }
    // Set current workspace
    static async setCurrentWorkspace(workspaceId) {
      const data = await this.getWorkspaceData();
      data.workspaces.forEach((w) => w.active = w.id === workspaceId);
      data.currentWorkspaceId = workspaceId;
      await this.saveWorkspaceData(data);
    }
    // Create new workspace
    static async createWorkspace(name) {
      const data = await this.getWorkspaceData();
      const newWorkspace = {
        id: `workspace-${Date.now()}`,
        name,
        active: false,
        bookmarks: [],
        openTabs: [],
        closedTabs: [],
        settings: { ...DEFAULT_SETTINGS },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      data.workspaces.push(newWorkspace);
      await this.saveWorkspaceData(data);
      return newWorkspace;
    }
    // Update workspace
    static async updateWorkspace(workspaceId, updates) {
      const data = await this.getWorkspaceData();
      const index = data.workspaces.findIndex((w) => w.id === workspaceId);
      if (index === -1) throw new Error("Workspace not found");
      data.workspaces[index] = {
        ...data.workspaces[index],
        ...updates,
        updatedAt: Date.now()
      };
      await this.saveWorkspaceData(data);
    }
    // Delete workspace
    static async deleteWorkspace(workspaceId) {
      const data = await this.getWorkspaceData();
      if (data.workspaces.length === 1) {
        throw new Error("Cannot delete the last workspace");
      }
      data.workspaces = data.workspaces.filter((w) => w.id !== workspaceId);
      if (data.currentWorkspaceId === workspaceId) {
        data.currentWorkspaceId = data.workspaces[0].id;
        data.workspaces[0].active = true;
      }
      await this.saveWorkspaceData(data);
    }
    // Add bookmark to workspace
    static async addBookmark(workspaceId, bookmark) {
      const workspace = (await this.getWorkspaceData()).workspaces.find((w) => w.id === workspaceId);
      if (!workspace) throw new Error("Workspace not found");
      workspace.bookmarks.push(bookmark);
      await this.updateWorkspace(workspaceId, { bookmarks: workspace.bookmarks });
    }
    // Update bookmark
    static async updateBookmark(workspaceId, bookmarkId, updates) {
      const workspace = (await this.getWorkspaceData()).workspaces.find((w) => w.id === workspaceId);
      if (!workspace) throw new Error("Workspace not found");
      const index = workspace.bookmarks.findIndex((b) => b.id === bookmarkId);
      if (index === -1) throw new Error("Bookmark not found");
      workspace.bookmarks[index] = { ...workspace.bookmarks[index], ...updates };
      await this.updateWorkspace(workspaceId, { bookmarks: workspace.bookmarks });
    }
    // Delete bookmark
    static async deleteBookmark(workspaceId, bookmarkId) {
      const workspace = (await this.getWorkspaceData()).workspaces.find((w) => w.id === workspaceId);
      if (!workspace) throw new Error("Workspace not found");
      workspace.bookmarks = workspace.bookmarks.filter((b) => b.id !== bookmarkId);
      await this.updateWorkspace(workspaceId, { bookmarks: workspace.bookmarks });
    }
    // Reorder bookmarks (for drag-and-drop)
    static async reorderBookmarks(workspaceId, bookmarkIds) {
      const workspace = (await this.getWorkspaceData()).workspaces.find((w) => w.id === workspaceId);
      if (!workspace) throw new Error("Workspace not found");
      const bookmarkMap = new Map(workspace.bookmarks.map((b) => [b.id, b]));
      workspace.bookmarks = bookmarkIds.map((id, index) => ({
        ...bookmarkMap.get(id),
        position: index
      }));
      await this.updateWorkspace(workspaceId, { bookmarks: workspace.bookmarks });
    }
    // Save closed tabs (for remembering on browser close) and which tab was focused.
    // Store only { url, title } so chrome.storage serialization is reliable (full Tab objects can lose .url).
    static async saveClosedTabs(workspaceId, tabs) {
      const activeTab = tabs.find((t) => t.active);
      const activeTabUrl = activeTab?.url && !activeTab.url.startsWith("chrome://") && !activeTab.url.startsWith("chrome-extension://") ? activeTab.url : void 0;
      const closedTabs = tabs.filter((t) => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("chrome-extension://")).map((t) => ({ url: t.url, title: t.title }));
      await this.updateWorkspace(workspaceId, { closedTabs, activeTabUrl: activeTabUrl ?? void 0 });
    }
    // Update workspace settings
    static async updateWorkspaceSettings(workspaceId, settings) {
      const workspace = (await this.getWorkspaceData()).workspaces.find((w) => w.id === workspaceId);
      if (!workspace) throw new Error("Workspace not found");
      workspace.settings = { ...workspace.settings, ...settings };
      await this.updateWorkspace(workspaceId, { settings: workspace.settings });
    }
  };
  StorageService.STORAGE_KEY = "workspaceData";

  // src/background.ts
  console.log("Background service worker initialized");
  chrome.runtime.onInstalled.addListener(async () => {
    console.log("Extension installed");
    chrome.sidePanel.setOptions({
      path: "dist/sidepanel.html",
      enabled: true
    });
    await StorageService.getWorkspaceData();
  });
  chrome.sidePanel.onPanelOpened?.addListener(() => {
    console.log("Side panel opened");
  });
  chrome.runtime.onSuspend?.addListener(async () => {
    console.log("Extension suspending - saving workspace tabs");
    await saveAllWorkspaceTabs();
  });
  chrome.tabs.onRemoved.addListener(async () => {
    setTimeout(async () => {
      await saveAllWorkspaceTabs();
    }, 1e3);
  });
  async function saveAllWorkspaceTabs() {
    try {
      const data = await StorageService.getWorkspaceData();
      if (!data.currentWorkspaceId) return;
      const win = await chrome.windows.getLastFocused({ populate: false }).catch(() => null);
      const tabQuery = win?.id != null ? { windowId: win.id } : {};
      const tabs = await chrome.tabs.query(tabQuery);
      await StorageService.saveClosedTabs(data.currentWorkspaceId, tabs);
    } catch (error) {
      console.error("Error saving workspace tabs:", error);
    }
  }
  function resolveWindowId(sender) {
    if (sender.tab != null && sender.tab.windowId != null) {
      return Promise.resolve(sender.tab.windowId);
    }
    return chrome.windows.getLastFocused({ populate: false }).then((win) => win?.id ?? 0).catch(() => 0);
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "switchWorkspace") {
      resolveWindowId(sender).then((windowId) => handleWorkspaceSwitch(message.workspaceId, windowId)).then(() => sendResponse({ success: true })).catch((error) => {
        console.error("Error switching workspace:", error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
    if (message.type === "getCurrentWorkspace") {
      StorageService.getWorkspaceData().then((data) => sendResponse({ workspaceId: data.currentWorkspaceId })).catch(() => sendResponse({ workspaceId: "default" }));
      return true;
    }
    if (message.type === "deleteWorkspace") {
      const workspaceId = message.workspaceId;
      StorageService.getWorkspaceData().then((data) => {
        if (!data.workspaces || data.workspaces.length <= 1) {
          sendResponse({ success: false, error: "Cannot delete the last workspace" });
          return Promise.reject(new Error("abort"));
        }
        const wasCurrent = data.currentWorkspaceId === workspaceId;
        return StorageService.deleteWorkspace(workspaceId).then(() => wasCurrent);
      }).then((wasCurrent) => {
        if (!wasCurrent) return;
        return resolveWindowId(sender).then(
          (windowId) => StorageService.getWorkspaceData().then(
            (newData) => replaceWindowTabsWithWorkspaceTabs(newData.currentWorkspaceId, windowId)
          )
        );
      }).then(() => sendResponse({ success: true })).catch((err) => {
        if (err?.message !== "abort") {
          console.error("Error deleting workspace:", err);
          sendResponse({ success: false, error: err?.message ?? "Unknown error" });
        }
      });
      return true;
    }
  });
  async function handleWorkspaceSwitch(workspaceId, windowId) {
    const tabQuery = windowId != null && windowId !== 0 ? { windowId } : {};
    const data = await StorageService.getWorkspaceData();
    const leavingWorkspaceId = data.currentWorkspaceId;
    if (leavingWorkspaceId && leavingWorkspaceId !== workspaceId) {
      const allTabs = await chrome.tabs.query(tabQuery);
      const activeTab = allTabs.find((t) => t.active);
      const activeTabUrl = activeTab?.url && !activeTab.url.startsWith("chrome://") && !activeTab.url.startsWith("chrome-extension://") ? activeTab.url : void 0;
      const closedTabs = allTabs.filter((t) => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("chrome-extension://")).map((t) => ({ url: t.url, title: t.title }));
      const leaving = data.workspaces.find((w) => w.id === leavingWorkspaceId);
      if (leaving) {
        leaving.closedTabs = closedTabs;
        leaving.activeTabUrl = activeTabUrl;
      }
    }
    data.currentWorkspaceId = workspaceId;
    data.workspaces.forEach((w) => {
      w.active = w.id === workspaceId;
    });
    await StorageService.saveWorkspaceData(data);
    const workspace = data.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const settings = workspace.settings ?? {};
    const onCloseBehavior = settings.onCloseBehavior ?? "continue";
    const defaultTabs = settings.defaultTabs ?? [];
    if (onCloseBehavior === "default" && defaultTabs.length > 0) {
      const currentTabs = await chrome.tabs.query(tabQuery);
      const tabsToClose = currentTabs.filter((tab) => tab.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")).map((tab) => tab.id);
      const existingUrls = new Set(currentTabs.map((tab) => tab.url).filter(Boolean));
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
      await replaceWindowTabsWithWorkspaceTabs(workspaceId, windowId, workspace);
    }
  }
  async function replaceWindowTabsWithWorkspaceTabs(workspaceId, windowId, workspaceFromMemory) {
    const tabQuery = windowId != null && windowId !== 0 ? { windowId } : {};
    const workspace = workspaceFromMemory ?? (await StorageService.getWorkspaceData()).workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const currentTabs = await chrome.tabs.query(tabQuery);
    const tabsToClose = currentTabs.filter((tab) => tab.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")).map((tab) => tab.id);
    if (workspace.closedTabs && workspace.closedTabs.length > 0) {
      const existingUrls = new Set(currentTabs.map((tab) => tab.url).filter(Boolean));
      let created = 0;
      let activeTabId;
      for (const tab of workspace.closedTabs) {
        if (tab.url && !existingUrls.has(tab.url)) {
          const createdTab = await chrome.tabs.create({ url: tab.url, active: false, windowId });
          created++;
          if (tab.url === workspace.activeTabUrl) {
            activeTabId = createdTab.id;
          }
        }
      }
      if (tabsToClose.length > 0 && created > 0) {
        await chrome.tabs.remove(tabsToClose);
      }
      if (activeTabId != null) {
        await chrome.tabs.update(activeTabId, { active: true });
        if (windowId != null) {
          await chrome.windows.update(windowId, { focused: true });
        }
      } else if (workspace.activeTabUrl && windowId != null) {
        const tabsInWindow = await chrome.tabs.query({ windowId });
        const tabToFocus = tabsInWindow.find((t) => t.url === workspace.activeTabUrl);
        if (tabToFocus?.id) {
          await chrome.tabs.update(tabToFocus.id, { active: true });
          await chrome.windows.update(windowId, { focused: true });
        }
      }
    } else {
      const data = await chrome.storage.local.get("newTabUrl");
      const raw = data?.newTabUrl != null && String(data.newTabUrl).trim() ? String(data.newTabUrl).trim() : "https://www.google.com/";
      const url = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
      await chrome.tabs.create({ url, active: true, windowId });
      if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose);
      }
    }
  }
  async function restoreWorkspaceTabs(workspaceId, clearExisting = false, windowId) {
    const workspace = (await StorageService.getWorkspaceData()).workspaces.find((w) => w.id === workspaceId);
    if (!workspace || !workspace.closedTabs?.length) return;
    const tabQuery = windowId != null && windowId !== 0 ? { windowId } : {};
    const currentTabs = await chrome.tabs.query(tabQuery);
    if (clearExisting && currentTabs.length > 0) {
      const tabsToClose = currentTabs.filter((tab) => tab.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")).map((tab) => tab.id);
      const existingUrls = new Set(currentTabs.map((tab) => tab.url).filter(Boolean));
      let created = 0;
      for (const tab of workspace.closedTabs) {
        if (tab.url && !existingUrls.has(tab.url)) {
          await chrome.tabs.create({ url: tab.url, active: false, windowId });
          existingUrls.add(tab.url);
          created++;
        }
      }
      if (tabsToClose.length > 0 && created > 0) {
        await chrome.tabs.remove(tabsToClose);
      }
    } else {
      const remainingTabs = await chrome.tabs.query(tabQuery);
      const existingUrls = new Set(remainingTabs.map((tab) => tab.url).filter(Boolean));
      for (const tab of workspace.closedTabs) {
        if (tab.url && !existingUrls.has(tab.url)) {
          await chrome.tabs.create({ url: tab.url, active: false, windowId });
          existingUrls.add(tab.url);
        }
      }
    }
  }
  chrome.runtime.onStartup.addListener(async () => {
    console.log("Extension startup - restoring workspace state");
    try {
      const workspace = await StorageService.getCurrentWorkspace();
      const win = await chrome.windows.getCurrent({ populate: false });
      const windowId = win?.id;
      const currentTabs = windowId != null ? await chrome.tabs.query({ windowId }) : await chrome.tabs.query({});
      const settings = workspace.settings ?? {};
      const onCloseBehavior = settings.onCloseBehavior ?? "continue";
      const defaultTabs = settings.defaultTabs ?? [];
      if (onCloseBehavior === "continue" && workspace.closedTabs?.length > 0) {
        if (windowId != null) {
          await restoreWorkspaceTabs(workspace.id, true, windowId);
        } else {
          await restoreWorkspaceTabs(workspace.id, true);
        }
      } else if (onCloseBehavior === "default" && defaultTabs.length > 0) {
        const existingUrls = new Set(currentTabs.map((tab) => tab.url).filter(Boolean));
        for (const url of defaultTabs) {
          if (!existingUrls.has(url)) {
            await chrome.tabs.create({ url, active: false, windowId });
            existingUrls.add(url);
          }
        }
      }
    } catch (error) {
      console.error("Error restoring workspace on startup:", error);
    }
  });
})();
