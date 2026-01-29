// Storage service for workspace-specific data
// Handles per-workspace bookmarks, tabs, settings, and history

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  position?: number; // For drag-and-drop ordering (legacy)
  // Snap-to-grid layout (Phase 3 will use this)
  gridRow?: number;
  gridCol?: number;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title?: string;
  favicon?: string;
  visitedAt: number;
  tabId?: number;
}

export interface Credential {
  id: string;
  url: string;
  username: string;
  password: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

/** Minimal tab info we persist; full Tab objects don't serialize reliably to chrome.storage */
export interface ClosedTabInfo {
  url: string;
  title?: string;
}

export interface Workspace {
  id: string;
  name: string;
  icon?: string; // Icon URL or preset identifier
  active: boolean;
  bookmarks: Bookmark[];
  openTabs: chrome.tabs.Tab[];
  closedTabs: ClosedTabInfo[]; // Remembered tabs when browser closes (plain objects for reliable storage)
  activeTabUrl?: string; // URL of the last focused tab in this workspace (for restore)
  settings: WorkspaceSettings;
   // Per-workspace browsing history (tracked while this workspace is active)
  history?: HistoryEntry[];
  // Per-workspace stored credentials (Phase 5 will use this)
  credentials?: Credential[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceSettings {
  // Panel appearance
  roundedCorners: boolean;
  marginFromSide: number; // pixels
  marginTop: number; // pixels
  marginBottom: number; // pixels
  width: number; // pixels (40-80px for sidebar)
  borderRadius: number; // pixels for panel border radius
  iconBorderRadius: number; // pixels for icon border radius
  position: 'left' | 'right'; // sidebar position
  alignment: 'top' | 'bottom'; // bookmark alignment
  
  // Theme/Colors
  backgroundColor: string; // panel background color
  iconBackgroundColor: string; // icon background color
  iconTextColor: string; // icon text color
  borderColor: string; // border color
  accentColor: string; // accent color for highlights, hover states, etc.
  themeId?: string; // ID of selected theme (if using a theme)
  customThemes?: CustomTheme[]; // User-defined custom themes
  iconPackId?: string; // ID of selected icon pack
  
  // Panel behavior
  mode: 'fixed' | 'hovering';
  collapsible: boolean;
  collapsed: boolean;

  // On-close behavior
  onCloseBehavior: 'continue' | 'default'; // continue where left off or open default tabs
  defaultTabs: string[]; // URLs to open on startup if onCloseBehavior is 'default'
}

export interface CustomTheme {
  id: string;
  name: string;
  backgroundColor: string;
  iconBackgroundColor: string;
  iconTextColor: string;
  borderColor: string;
  accentColor: string;
}

export interface WorkspaceData {
  workspaces: Workspace[];
  currentWorkspaceId: string;
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  roundedCorners: true,
  marginFromSide: 0,
  marginTop: 0,
  marginBottom: 0,
  width: 52, // Default sidebar width (40-80px range)
  borderRadius: 0, // Default panel border radius
  iconBorderRadius: 25, // Default icon border radius (max)
  position: 'left',
  alignment: 'top',
  backgroundColor: '#252526',
  iconBackgroundColor: '#2d2d2d',
  iconTextColor: '#d4d4d4',
  borderColor: '#3e3e42',
  accentColor: '#007acc',
  mode: 'fixed',
  collapsible: false,
  collapsed: false,
  onCloseBehavior: 'continue',
  defaultTabs: [],
  iconPackId: 'minimalist' // Default to minimalist icon pack
};

export class StorageService {
  private static readonly STORAGE_KEY = 'workspaceData';

  // Get all workspace data
  static async getWorkspaceData(): Promise<WorkspaceData> {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    if (!result[this.STORAGE_KEY]) {
      // Initialize with default workspace
      const defaultData: WorkspaceData = {
        workspaces: [{
          id: 'default',
          name: 'Default',
          active: true,
          bookmarks: [],
          openTabs: [],
          closedTabs: [],
          settings: { ...DEFAULT_SETTINGS },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        currentWorkspaceId: 'default'
      };
      await this.saveWorkspaceData(defaultData);
      return defaultData;
    }
    return result[this.STORAGE_KEY] as WorkspaceData;
  }

  // Save all workspace data
  static async saveWorkspaceData(data: WorkspaceData): Promise<void> {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: data });
  }

  // Get current workspace
  static async getCurrentWorkspace(): Promise<Workspace> {
    const data = await this.getWorkspaceData();
    const workspace = data.workspaces.find(w => w.id === data.currentWorkspaceId);
    if (!workspace) {
      throw new Error('Current workspace not found');
    }
    return workspace;
  }

  // Set current workspace
  static async setCurrentWorkspace(workspaceId: string): Promise<void> {
    const data = await this.getWorkspaceData();
    data.workspaces.forEach(w => w.active = w.id === workspaceId);
    data.currentWorkspaceId = workspaceId;
    await this.saveWorkspaceData(data);
  }

  // Create new workspace
  static async createWorkspace(name: string): Promise<Workspace> {
    const data = await this.getWorkspaceData();
    const newWorkspace: Workspace = {
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
  static async updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<void> {
    const data = await this.getWorkspaceData();
    const index = data.workspaces.findIndex(w => w.id === workspaceId);
    if (index === -1) throw new Error('Workspace not found');
    
    data.workspaces[index] = {
      ...data.workspaces[index],
      ...updates,
      updatedAt: Date.now()
    };
    await this.saveWorkspaceData(data);
  }

  // Delete workspace
  static async deleteWorkspace(workspaceId: string): Promise<void> {
    const data = await this.getWorkspaceData();
    if (data.workspaces.length === 1) {
      throw new Error('Cannot delete the last workspace');
    }
    data.workspaces = data.workspaces.filter(w => w.id !== workspaceId);
    if (data.currentWorkspaceId === workspaceId) {
      data.currentWorkspaceId = data.workspaces[0].id;
      data.workspaces[0].active = true;
    }
    await this.saveWorkspaceData(data);
  }

  // Add bookmark to workspace
  static async addBookmark(workspaceId: string, bookmark: Bookmark): Promise<void> {
    const workspace = (await this.getWorkspaceData()).workspaces.find(w => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');
    
    workspace.bookmarks.push(bookmark);
    await this.updateWorkspace(workspaceId, { bookmarks: workspace.bookmarks });
  }

  // Update bookmark
  static async updateBookmark(workspaceId: string, bookmarkId: string, updates: Partial<Bookmark>): Promise<void> {
    const workspace = (await this.getWorkspaceData()).workspaces.find(w => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');
    
    const index = workspace.bookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) throw new Error('Bookmark not found');
    
    workspace.bookmarks[index] = { ...workspace.bookmarks[index], ...updates };
    await this.updateWorkspace(workspaceId, { bookmarks: workspace.bookmarks });
  }

  // Delete bookmark
  static async deleteBookmark(workspaceId: string, bookmarkId: string): Promise<void> {
    const workspace = (await this.getWorkspaceData()).workspaces.find(w => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');
    
    workspace.bookmarks = workspace.bookmarks.filter(b => b.id !== bookmarkId);
    await this.updateWorkspace(workspaceId, { bookmarks: workspace.bookmarks });
  }

  // Reorder bookmarks (for drag-and-drop)
  static async reorderBookmarks(workspaceId: string, bookmarkIds: string[]): Promise<void> {
    const workspace = (await this.getWorkspaceData()).workspaces.find(w => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');
    
    const bookmarkMap = new Map(workspace.bookmarks.map(b => [b.id, b]));
    workspace.bookmarks = bookmarkIds.map((id, index) => ({
      ...bookmarkMap.get(id)!,
      position: index
    }));
    await this.updateWorkspace(workspaceId, { bookmarks: workspace.bookmarks });
  }

  // Save closed tabs (for remembering on browser close) and which tab was focused.
  // Store only { url, title } so chrome.storage serialization is reliable (full Tab objects can lose .url).
  static async saveClosedTabs(workspaceId: string, tabs: chrome.tabs.Tab[]): Promise<void> {
    const activeTab = tabs.find(t => t.active);
    const activeTabUrl = activeTab?.url && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('chrome-extension://')
      ? activeTab.url
      : undefined;
    const closedTabs: ClosedTabInfo[] = tabs
      .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
      .map(t => ({ url: t.url!, title: t.title }));
    await this.updateWorkspace(workspaceId, { closedTabs, activeTabUrl: activeTabUrl ?? undefined });
  }

  // Update workspace settings
  static async updateWorkspaceSettings(workspaceId: string, settings: Partial<WorkspaceSettings>): Promise<void> {
    const workspace = (await this.getWorkspaceData()).workspaces.find(w => w.id === workspaceId);
    if (!workspace) throw new Error('Workspace not found');
    
    workspace.settings = { ...workspace.settings, ...settings };
    await this.updateWorkspace(workspaceId, { settings: workspace.settings });
  }
}
