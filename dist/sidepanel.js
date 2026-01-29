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

// src/icons.ts
var MINIMALIST_ICON_PACK = {
  id: "minimalist",
  name: "Minimalist",
  icons: {
    // Settings gear icon
    settings: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 10.5C9.38071 10.5 10.5 9.38071 10.5 8C10.5 6.61929 9.38071 5.5 8 5.5C6.61929 5.5 5.5 6.61929 5.5 8C5.5 9.38071 6.61929 10.5 8 10.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11.5 8.5L12.5 9.5L14.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 2.5L9.5 4.5L8 6.5L6.5 4.5L8 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2.5 8L4.5 6.5L6.5 8L4.5 9.5L2.5 8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 9.5L6.5 11.5L8 13.5L9.5 11.5L8 9.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13.5 8L11.5 9.5L9.5 8L11.5 6.5L13.5 8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    // Collapse left arrow
    collapseLeft: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 9L4.5 6L7.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    // Expand right arrow
    expandRight: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 9L7.5 6L4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    // Menu dots (vertical)
    menu: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="2" r="1" fill="currentColor"/>
      <circle cx="6" cy="6" r="1" fill="currentColor"/>
      <circle cx="6" cy="10" r="1" fill="currentColor"/>
    </svg>`,
    // Link/bookmark icon
    link: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 9.5L9.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M7.5 6.5H9.5V8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11.5 4.5C12.0523 5.05228 12.0523 5.94772 11.5 6.5L9.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4.5 11.5C3.94772 10.9477 3.94772 10.0523 4.5 9.5L6.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6.5 7.5H4.5V9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    // Add/plus icon
    add: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    // Delete/close icon
    delete: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    // Close/X icon
    close: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  }
};
var SIMPLE_LINE_ICON_PACK = {
  id: "simple-line",
  name: "Simple Line",
  icons: {
    settings: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.2"/>
      <path d="M8 1V3M8 13V15M15 8H13M3 8H1M13.5 2.5L12 4M4 12L2.5 13.5M13.5 13.5L12 12M4 4L2.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    collapseLeft: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3L4 6L8 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    expandRight: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 3L8 6L4 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    menu: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2V2M6 6V6M6 10V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="6" cy="2" r="0.8" fill="currentColor"/>
      <circle cx="6" cy="6" r="0.8" fill="currentColor"/>
      <circle cx="6" cy="10" r="0.8" fill="currentColor"/>
    </svg>`,
    link: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 5H5C3.89543 5 3 5.89543 3 7V11C3 12.1046 3.89543 13 5 13H9C10.1046 13 11 12.1046 11 11V9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M9 11H11C12.1046 11 13 10.1046 13 9V5C13 3.89543 12.1046 3 11 3H7C5.89543 3 5 3.89543 5 5V7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    add: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    delete: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    close: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  }
};
var ULTRA_MINIMAL_ICON_PACK = {
  id: "ultra-minimal",
  name: "Ultra Minimal",
  icons: {
    settings: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1"/>
      <path d="M8 0.5V3M8 13V15.5M15.5 8H13M3 8H0.5M14 2L12.5 3.5M3.5 12.5L2 14M14 14L12.5 12.5M3.5 3.5L2 2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    </svg>`,
    collapseLeft: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 2L2.5 6L7.5 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    expandRight: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 2L9.5 6L4.5 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    menu: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="6" y1="1.5" x2="6" y2="3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="6" y1="5.5" x2="6" y2="7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="6" y1="9.5" x2="6" y2="11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    link: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 6.5L9.5 9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
      <path d="M9.5 6.5H11.5C12.6046 6.5 13.5 7.39543 13.5 8.5V11.5C13.5 12.6046 12.6046 13.5 11.5 13.5H8.5C7.39543 13.5 6.5 12.6046 6.5 11.5V9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
      <path d="M9.5 9.5H7.5C6.39543 9.5 5.5 8.60457 5.5 7.5V4.5C5.5 3.39543 6.39543 2.5 7.5 2.5H10.5C11.6046 2.5 12.5 3.39543 12.5 4.5V6.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    </svg>`,
    add: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    delete: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="3.5" y1="3.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="10.5" y1="3.5" x2="3.5" y2="10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    close: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="3.5" y1="3.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="10.5" y1="3.5" x2="3.5" y2="10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`
  }
};
var ICON_PACKS = [
  MINIMALIST_ICON_PACK,
  SIMPLE_LINE_ICON_PACK,
  ULTRA_MINIMAL_ICON_PACK
];
function getIconPack(id) {
  return ICON_PACKS.find((pack) => pack.id === id) || MINIMALIST_ICON_PACK;
}
function getIcon(iconPack, iconName) {
  return iconPack.icons[iconName] || iconPack.icons.link || "";
}

// src/sidepanel.ts
var SidePanelManager = class {
  constructor() {
    this.currentWorkspace = null;
    this.isDragging = false;
    this.draggedElement = null;
    this.dragOverElement = null;
    this.initializeUI();
    this.loadWorkspaceData();
  }
  async initializeUI() {
    console.log("Initializing side panel UI");
    const sidepanelContainer = document.getElementById("sidepanel");
    if (!sidepanelContainer) return;
    const settingsBtn = document.createElement("button");
    settingsBtn.id = "settings-btn";
    settingsBtn.className = "settings-btn icon-btn";
    settingsBtn.title = "Settings";
    settingsBtn.addEventListener("click", () => this.openSettings());
    sidepanelContainer.appendChild(settingsBtn);
    const collapseBtn = document.createElement("button");
    collapseBtn.id = "collapse-btn";
    collapseBtn.className = "collapse-btn icon-btn";
    collapseBtn.title = "Collapse";
    collapseBtn.addEventListener("click", () => this.toggleCollapse());
    sidepanelContainer.appendChild(collapseBtn);
    const workspaceSwitcher = document.createElement("div");
    workspaceSwitcher.id = "workspace-switcher";
    workspaceSwitcher.className = "workspace-switcher";
    sidepanelContainer.appendChild(workspaceSwitcher);
    const bookmarksContainer = document.createElement("div");
    bookmarksContainer.id = "bookmarks-container";
    bookmarksContainer.className = "bookmarks-container";
    sidepanelContainer.appendChild(bookmarksContainer);
    const settingsPanel = document.createElement("div");
    settingsPanel.id = "settings-panel";
    settingsPanel.className = "settings-panel hidden";
    sidepanelContainer.appendChild(settingsPanel);
    this.applyWorkspaceStyles();
  }
  async loadWorkspaceData() {
    try {
      this.currentWorkspace = await StorageService.getCurrentWorkspace();
      this.renderUI();
      this.applyWorkspaceStyles();
    } catch (error) {
      console.error("Error loading workspace data:", error);
    }
  }
  async renderUI() {
    if (!this.currentWorkspace) return;
    await this.renderWorkspaceSwitcher();
    await this.renderBookmarks();
    this.updateCollapseButton();
    this.updateIcons();
  }
  updateIcons() {
    if (!this.currentWorkspace) return;
    const iconPackId = this.currentWorkspace.settings.iconPackId || "minimalist";
    const iconPack = getIconPack(iconPackId);
    const settingsBtn = document.getElementById("settings-btn");
    if (settingsBtn) {
      settingsBtn.innerHTML = getIcon(iconPack, "settings");
    }
    const collapseBtn = document.getElementById("collapse-btn");
    if (collapseBtn) {
      const iconName = this.currentWorkspace.settings.collapsed ? "expandRight" : "collapseLeft";
      collapseBtn.innerHTML = getIcon(iconPack, iconName);
    }
  }
  async renderWorkspaceSwitcher() {
    const switcher = document.getElementById("workspace-switcher");
    if (!switcher) return;
    const data = await StorageService.getWorkspaceData();
    const workspaces = data.workspaces;
    const currentWorkspace = workspaces.find((w) => w.active) || workspaces[0];
    const iconPackId = currentWorkspace?.settings?.iconPackId || "minimalist";
    const iconPack = getIconPack(iconPackId);
    switcher.innerHTML = `
      <div class="workspace-header">
        <h3>Workspaces</h3>
        <button id="add-workspace-btn" class="icon-btn" title="Add new workspace">${getIcon(iconPack, "add")}</button>
      </div>
      <div class="workspace-list">
        ${workspaces.map(
      (ws) => {
        const wsIconPackId = ws.settings?.iconPackId || iconPackId;
        const wsIconPack = getIconPack(wsIconPackId);
        return `
          <div class="workspace-item ${ws.active ? "active" : ""}" data-workspace-id="${ws.id}">
            <span class="workspace-name">${ws.name}</span>
            <button class="workspace-menu-btn icon-btn" data-workspace-id="${ws.id}">${getIcon(wsIconPack, "menu")}</button>
          </div>
        `;
      }
    ).join("")}
      </div>
    `;
    this.attachWorkspaceListeners();
  }
  async renderBookmarks() {
    const container = document.getElementById("bookmarks-container");
    if (!container || !this.currentWorkspace) return;
    const sortedBookmarks = [...this.currentWorkspace.bookmarks].sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      return posA - posB;
    });
    const iconPackId = this.currentWorkspace.settings.iconPackId || "minimalist";
    const iconPack = getIconPack(iconPackId);
    container.innerHTML = `
      <div class="bookmarks-header">
        <h3>Bookmarks</h3>
        <button id="add-bookmark-btn" class="icon-btn" title="Add new bookmark">${getIcon(iconPack, "add")}</button>
      </div>
      <div class="bookmarks-list" id="bookmarks-list">
        ${sortedBookmarks.length === 0 ? '<div class="empty-state">No bookmarks yet. Click + to add one.</div>' : sortedBookmarks.map(
      (bookmark) => {
        const faviconHtml = bookmark.favicon || getIcon(iconPack, "link");
        return `
          <div class="bookmark-item" draggable="true" data-bookmark-id="${bookmark.id}">
            <span class="bookmark-favicon">${faviconHtml}</span>
            <a href="${bookmark.url}" target="_blank" class="bookmark-link" title="${bookmark.title}">
              ${bookmark.title}
            </a>
            <button class="bookmark-delete-btn icon-btn" data-bookmark-id="${bookmark.id}" title="Delete">${getIcon(iconPack, "delete")}</button>
          </div>
        `;
      }
    ).join("")}
      </div>
    `;
    this.attachBookmarkListeners();
    this.setupDragAndDrop();
  }
  attachWorkspaceListeners() {
    const addBtn = document.getElementById("add-workspace-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => this.createWorkspace());
    }
    const workspaceItems = document.querySelectorAll(".workspace-item");
    workspaceItems.forEach((item) => {
      const workspaceId = item.getAttribute("data-workspace-id");
      if (!workspaceId) return;
      item.addEventListener("click", async (e) => {
        if (!e.target.classList.contains("workspace-menu-btn")) {
          await this.switchWorkspace(workspaceId);
        }
      });
    });
    const menuBtns = document.querySelectorAll(".workspace-menu-btn");
    menuBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const workspaceId = e.target.getAttribute("data-workspace-id");
        if (workspaceId) {
          this.showWorkspaceMenu(workspaceId);
        }
      });
    });
  }
  attachBookmarkListeners() {
    const addBtn = document.getElementById("add-bookmark-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => this.createBookmark());
    }
    const deleteBtns = document.querySelectorAll(".bookmark-delete-btn");
    deleteBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const bookmarkId = e.target.getAttribute("data-bookmark-id");
        if (bookmarkId && this.currentWorkspace) {
          await StorageService.deleteBookmark(this.currentWorkspace.id, bookmarkId);
          await this.loadWorkspaceData();
        }
      });
    });
  }
  setupDragAndDrop() {
    const bookmarkItems = document.querySelectorAll(".bookmark-item");
    bookmarkItems.forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        this.isDragging = true;
        this.draggedElement = item;
        e.target.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      item.addEventListener("dragend", (e) => {
        e.target.classList.remove("dragging");
        document.querySelectorAll(".bookmark-item").forEach((el) => {
          el.classList.remove("drag-over");
        });
        this.isDragging = false;
        this.draggedElement = null;
        this.dragOverElement = null;
      });
      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (this.draggedElement && item !== this.draggedElement) {
          this.dragOverElement = item;
          item.classList.add("drag-over");
        }
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });
      item.addEventListener("drop", async (e) => {
        e.preventDefault();
        item.classList.remove("drag-over");
        if (this.draggedElement && this.currentWorkspace) {
          const list = document.getElementById("bookmarks-list");
          if (!list) return;
          const items = Array.from(list.querySelectorAll(".bookmark-item"));
          const draggedId = this.draggedElement.getAttribute("data-bookmark-id");
          const targetId = item.getAttribute("data-bookmark-id");
          if (draggedId && targetId && draggedId !== targetId) {
            const draggedIndex = items.indexOf(this.draggedElement);
            const targetIndex = items.indexOf(item);
            if (draggedIndex < targetIndex) {
              list.insertBefore(this.draggedElement, item.nextSibling);
            } else {
              list.insertBefore(this.draggedElement, item);
            }
            const newOrder = Array.from(list.querySelectorAll(".bookmark-item")).map(
              (el) => el.getAttribute("data-bookmark-id")
            );
            await StorageService.reorderBookmarks(this.currentWorkspace.id, newOrder);
            await this.loadWorkspaceData();
          }
        }
      });
    });
  }
  async switchWorkspace(workspaceId) {
    await StorageService.setCurrentWorkspace(workspaceId);
    await this.loadWorkspaceData();
  }
  async createWorkspace() {
    const name = prompt("Enter workspace name:");
    if (!name || name.trim() === "") return;
    try {
      await StorageService.createWorkspace(name.trim());
      await this.loadWorkspaceData();
    } catch (error) {
      console.error("Error creating workspace:", error);
      alert("Failed to create workspace");
    }
  }
  async createBookmark() {
    if (!this.currentWorkspace) return;
    const url = prompt("Enter bookmark URL:");
    if (!url || url.trim() === "") return;
    const title = prompt("Enter bookmark title (optional):") || new URL(url).hostname;
    try {
      const bookmark = {
        id: `bookmark-${Date.now()}`,
        title: title.trim(),
        url: url.trim(),
        position: this.currentWorkspace.bookmarks.length
      };
      await StorageService.addBookmark(this.currentWorkspace.id, bookmark);
      await this.loadWorkspaceData();
    } catch (error) {
      console.error("Error creating bookmark:", error);
      alert("Failed to create bookmark");
    }
  }
  showWorkspaceMenu(workspaceId) {
    const action = prompt("Workspace actions:\n1. Rename\n2. Delete\n3. Settings\n\nEnter number:");
    if (action === "1") {
      this.renameWorkspace(workspaceId);
    } else if (action === "2") {
      this.deleteWorkspace(workspaceId);
    } else if (action === "3") {
      this.openSettings(workspaceId);
    }
  }
  async renameWorkspace(workspaceId) {
    const data = await StorageService.getWorkspaceData();
    const workspace = data.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const newName = prompt("Enter new workspace name:", workspace.name);
    if (!newName || newName.trim() === "") return;
    await StorageService.updateWorkspace(workspaceId, { name: newName.trim() });
    await this.loadWorkspaceData();
  }
  async deleteWorkspace(workspaceId) {
    if (!confirm("Are you sure you want to delete this workspace?")) return;
    try {
      await StorageService.deleteWorkspace(workspaceId);
      await this.loadWorkspaceData();
    } catch (error) {
      alert(error.message || "Failed to delete workspace");
    }
  }
  async toggleCollapse() {
    if (!this.currentWorkspace) return;
    if (!this.currentWorkspace.settings.collapsible) return;
    const newCollapsed = !this.currentWorkspace.settings.collapsed;
    await StorageService.updateWorkspaceSettings(this.currentWorkspace.id, { collapsed: newCollapsed });
    await this.loadWorkspaceData();
  }
  updateCollapseButton() {
    const collapseBtn = document.getElementById("collapse-btn");
    if (!collapseBtn || !this.currentWorkspace) return;
    const settings = this.currentWorkspace.settings;
    collapseBtn.style.display = settings.collapsible ? "block" : "none";
    const iconPackId = settings.iconPackId || "minimalist";
    const iconPack = getIconPack(iconPackId);
    collapseBtn.innerHTML = settings.collapsed ? getIcon(iconPack, "expandRight") : getIcon(iconPack, "collapseLeft");
    const sidepanel = document.getElementById("sidepanel");
    if (sidepanel) {
      const isCollapsed = settings.collapsible && settings.collapsed;
      sidepanel.classList.toggle("collapsed", isCollapsed);
    }
  }
  async openSettings(workspaceId) {
    const targetWorkspaceId = workspaceId || this.currentWorkspace?.id;
    if (!targetWorkspaceId) return;
    const workspace = (await StorageService.getWorkspaceData()).workspaces.find((w) => w.id === targetWorkspaceId);
    if (!workspace) return;
    const settingsPanel = document.getElementById("settings-panel");
    if (!settingsPanel) return;
    settingsPanel.innerHTML = `
      <div class="settings-header">
        <h3>Settings: ${workspace.name}</h3>
        <button id="close-settings-btn" class="icon-btn">${getIcon(getIconPack(workspace.settings.iconPackId || "minimalist"), "close")}</button>
      </div>
      <div class="settings-content">
        <div class="setting-group">
          <h4>Appearance</h4>
          <label>
            <input type="checkbox" id="rounded-corners" ${workspace.settings.roundedCorners ? "checked" : ""}>
            Rounded corners
          </label>
          <label>
            Margin from side: <input type="number" id="margin-side" value="${workspace.settings.marginFromSide}" min="0" max="100">
          </label>
          <label>
            Margin top: <input type="number" id="margin-top" value="${workspace.settings.marginTop}" min="0" max="100">
          </label>
          <label>
            Margin bottom: <input type="number" id="margin-bottom" value="${workspace.settings.marginBottom}" min="0" max="100">
          </label>
          <label>
            Width: <input type="number" id="panel-width" value="${workspace.settings.width}" min="200" max="600">
          </label>
        </div>
        <div class="setting-group">
          <h4>Behavior</h4>
          <label>
            Mode:
            <select id="panel-mode">
              <option value="fixed" ${workspace.settings.mode === "fixed" ? "selected" : ""}>Fixed</option>
              <option value="hovering" ${workspace.settings.mode === "hovering" ? "selected" : ""}>Hovering</option>
            </select>
          </label>
          <label>
            <input type="checkbox" id="collapsible" ${workspace.settings.collapsible ? "checked" : ""}>
            Collapsible
          </label>
        </div>
        <div class="setting-group">
          <h4>Icons</h4>
          <label>
            Icon Pack:
            <select id="icon-pack">
              ${ICON_PACKS.map(
      (pack) => `<option value="${pack.id}" ${(workspace.settings.iconPackId || "minimalist") === pack.id ? "selected" : ""}>${pack.name}</option>`
    ).join("")}
            </select>
          </label>
        </div>
        <div class="setting-group">
          <h4>On Close Behavior</h4>
          <label>
            <select id="on-close-behavior">
              <option value="continue" ${workspace.settings.onCloseBehavior === "continue" ? "selected" : ""}>Continue where left off</option>
              <option value="default" ${workspace.settings.onCloseBehavior === "default" ? "selected" : ""}>Open default tabs</option>
            </select>
          </label>
          <div id="default-tabs-section" style="margin-top: 10px;">
            <label>Default tabs (one URL per line):</label>
            <textarea id="default-tabs" rows="5" style="width: 100%;">${workspace.settings.defaultTabs.join("\n")}</textarea>
          </div>
        </div>
        <button id="save-settings-btn" class="save-btn">Save Settings</button>
      </div>
    `;
    settingsPanel.classList.remove("hidden");
    document.getElementById("close-settings-btn")?.addEventListener("click", () => {
      settingsPanel.classList.add("hidden");
    });
    document.getElementById("save-settings-btn")?.addEventListener("click", async () => {
      await this.saveSettings(targetWorkspaceId);
    });
  }
  async saveSettings(workspaceId) {
    const current = this.currentWorkspace;
    const collapsible = document.getElementById("collapsible")?.checked ?? true;
    const settings = {
      roundedCorners: document.getElementById("rounded-corners")?.checked ?? true,
      marginFromSide: parseInt(document.getElementById("margin-side")?.value || "10"),
      marginTop: parseInt(document.getElementById("margin-top")?.value || "10"),
      marginBottom: parseInt(document.getElementById("margin-bottom")?.value || "10"),
      width: parseInt(document.getElementById("panel-width")?.value || "300"),
      mode: document.getElementById("panel-mode")?.value,
      collapsible,
      // If collapsibility is turned off, force panel to expanded state
      collapsed: collapsible ? current?.settings.collapsed ?? false : false,
      onCloseBehavior: document.getElementById("on-close-behavior")?.value,
      defaultTabs: document.getElementById("default-tabs")?.value.split("\n").map((url) => url.trim()).filter((url) => url !== ""),
      iconPackId: document.getElementById("icon-pack")?.value || "minimalist"
    };
    if (settings.mode === "hovering") settings.collapsible = true;
    await StorageService.updateWorkspaceSettings(workspaceId, settings);
    await this.loadWorkspaceData();
    this.updateIcons();
    const settingsPanel = document.getElementById("settings-panel");
    if (settingsPanel) {
      settingsPanel.classList.add("hidden");
    }
  }
  applyWorkspaceStyles() {
    if (!this.currentWorkspace) return;
    const sidepanel = document.getElementById("sidepanel");
    if (!sidepanel) return;
    const settings = this.currentWorkspace.settings;
    const root = document.documentElement;
    root.style.setProperty("--panel-width", `${settings.width}px`);
    root.style.setProperty("--margin-side", `${settings.marginFromSide}px`);
    root.style.setProperty("--margin-top", `${settings.marginTop}px`);
    root.style.setProperty("--margin-bottom", `${settings.marginBottom}px`);
    sidepanel.classList.toggle("mode-fixed", settings.mode === "fixed");
    sidepanel.classList.toggle("mode-hovering", settings.mode === "hovering");
    sidepanel.classList.toggle("rounded-corners", settings.roundedCorners);
    sidepanel.classList.toggle("collapsed", settings.collapsed);
    sidepanel.classList.toggle("collapsible", settings.collapsible);
  }
};
document.addEventListener("DOMContentLoaded", () => {
  new SidePanelManager();
});
