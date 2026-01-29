// Side Panel UI Controller
// Manages bookmarks display, workspace switching, and customization

import { StorageService, Bookmark, Workspace, WorkspaceSettings } from './storage';
import { getIconPack, getIcon, ICON_PACKS } from './icons';

class SidePanelManager {
  private currentWorkspace: Workspace | null = null;
  private isDragging: boolean = false;
  private draggedElement: HTMLElement | null = null;
  private dragOverElement: HTMLElement | null = null;

  constructor() {
    this.initializeUI();
    this.loadWorkspaceData();
  }

  private async initializeUI(): Promise<void> {
    console.log('Initializing side panel UI');
    const sidepanelContainer = document.getElementById('sidepanel');
    if (!sidepanelContainer) return;

    // Create settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'settings-btn';
    settingsBtn.className = 'settings-btn icon-btn';
    settingsBtn.title = 'Settings';
    settingsBtn.addEventListener('click', () => this.openSettings());
    sidepanelContainer.appendChild(settingsBtn);

    // Create collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.id = 'collapse-btn';
    collapseBtn.className = 'collapse-btn icon-btn';
    collapseBtn.title = 'Collapse';
    collapseBtn.addEventListener('click', () => this.toggleCollapse());
    sidepanelContainer.appendChild(collapseBtn);

    // Create workspace switcher
    const workspaceSwitcher = document.createElement('div');
    workspaceSwitcher.id = 'workspace-switcher';
    workspaceSwitcher.className = 'workspace-switcher';
    sidepanelContainer.appendChild(workspaceSwitcher);

    // Create bookmarks container
    const bookmarksContainer = document.createElement('div');
    bookmarksContainer.id = 'bookmarks-container';
    bookmarksContainer.className = 'bookmarks-container';
    sidepanelContainer.appendChild(bookmarksContainer);

    // Create settings panel (hidden by default)
    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'settings-panel';
    settingsPanel.className = 'settings-panel hidden';
    sidepanelContainer.appendChild(settingsPanel);

    // Apply initial styles
    this.applyWorkspaceStyles();
  }

  private async loadWorkspaceData(): Promise<void> {
    try {
      this.currentWorkspace = await StorageService.getCurrentWorkspace();
      this.renderUI();
      this.applyWorkspaceStyles();
    } catch (error) {
      console.error('Error loading workspace data:', error);
    }
  }

  private async renderUI(): Promise<void> {
    if (!this.currentWorkspace) return;
    
    await this.renderWorkspaceSwitcher();
    await this.renderBookmarks();
    this.updateCollapseButton();
    this.updateIcons();
  }

  private updateIcons(): void {
    if (!this.currentWorkspace) return;
    
    const iconPackId = this.currentWorkspace.settings.iconPackId || 'minimalist';
    const iconPack = getIconPack(iconPackId);
    
    // Update settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.innerHTML = getIcon(iconPack, 'settings');
    }
    
    // Update collapse button
    const collapseBtn = document.getElementById('collapse-btn');
    if (collapseBtn) {
      const iconName = this.currentWorkspace.settings.collapsed ? 'expandRight' : 'collapseLeft';
      collapseBtn.innerHTML = getIcon(iconPack, iconName);
    }
  }

  private async renderWorkspaceSwitcher(): Promise<void> {
    const switcher = document.getElementById('workspace-switcher');
    if (!switcher) return;

    const data = await StorageService.getWorkspaceData();
    const workspaces = data.workspaces;
    
    // Use current workspace's icon pack, or default
    const currentWorkspace = workspaces.find(w => w.active) || workspaces[0];
    const iconPackId = currentWorkspace?.settings?.iconPackId || 'minimalist';
    const iconPack = getIconPack(iconPackId);

    switcher.innerHTML = `
      <div class="workspace-header">
        <h3>Workspaces</h3>
        <button id="add-workspace-btn" class="icon-btn" title="Add new workspace">${getIcon(iconPack, 'add')}</button>
      </div>
      <div class="workspace-list">
        ${workspaces
          .map(
            (ws) => {
              const wsIconPackId = ws.settings?.iconPackId || iconPackId;
              const wsIconPack = getIconPack(wsIconPackId);
              return `
          <div class="workspace-item ${ws.active ? 'active' : ''}" data-workspace-id="${ws.id}">
            <span class="workspace-name">${ws.name}</span>
            <button class="workspace-menu-btn icon-btn" data-workspace-id="${ws.id}">${getIcon(wsIconPack, 'menu')}</button>
          </div>
        `;
            }
          )
          .join('')}
      </div>
    `;

    this.attachWorkspaceListeners();
  }

  private async renderBookmarks(): Promise<void> {
    const container = document.getElementById('bookmarks-container');
    if (!container || !this.currentWorkspace) return;

    // Sort bookmarks by position if available
    const sortedBookmarks = [...this.currentWorkspace.bookmarks].sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      return posA - posB;
    });

    const iconPackId = this.currentWorkspace.settings.iconPackId || 'minimalist';
    const iconPack = getIconPack(iconPackId);

    container.innerHTML = `
      <div class="bookmarks-header">
        <h3>Bookmarks</h3>
        <button id="add-bookmark-btn" class="icon-btn" title="Add new bookmark">${getIcon(iconPack, 'add')}</button>
      </div>
      <div class="bookmarks-list" id="bookmarks-list">
        ${sortedBookmarks.length === 0
          ? '<div class="empty-state">No bookmarks yet. Click + to add one.</div>'
          : sortedBookmarks
              .map(
                (bookmark) => {
                  // Use favicon if available, otherwise use icon pack link icon
                  const faviconHtml = bookmark.favicon || getIcon(iconPack, 'link');
                  return `
          <div class="bookmark-item" draggable="true" data-bookmark-id="${bookmark.id}">
            <span class="bookmark-favicon">${faviconHtml}</span>
            <a href="${bookmark.url}" target="_blank" class="bookmark-link" title="${bookmark.title}">
              ${bookmark.title}
            </a>
            <button class="bookmark-delete-btn icon-btn" data-bookmark-id="${bookmark.id}" title="Delete">${getIcon(iconPack, 'delete')}</button>
          </div>
        `;
                }
              )
              .join('')}
      </div>
    `;

    this.attachBookmarkListeners();
    this.setupDragAndDrop();
  }

  private attachWorkspaceListeners(): void {
    const addBtn = document.getElementById('add-workspace-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.createWorkspace());
    }

    const workspaceItems = document.querySelectorAll('.workspace-item');
    workspaceItems.forEach((item) => {
      const workspaceId = item.getAttribute('data-workspace-id');
      if (!workspaceId) return;

      item.addEventListener('click', async (e) => {
        if (!(e.target as HTMLElement).classList.contains('workspace-menu-btn')) {
          await this.switchWorkspace(workspaceId);
        }
      });
    });

    const menuBtns = document.querySelectorAll('.workspace-menu-btn');
    menuBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const workspaceId = (e.target as HTMLElement).getAttribute('data-workspace-id');
        if (workspaceId) {
          this.showWorkspaceMenu(workspaceId);
        }
      });
    });
  }

  private attachBookmarkListeners(): void {
    const addBtn = document.getElementById('add-bookmark-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.createBookmark());
    }

    const deleteBtns = document.querySelectorAll('.bookmark-delete-btn');
    deleteBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const bookmarkId = (e.target as HTMLElement).getAttribute('data-bookmark-id');
        if (bookmarkId && this.currentWorkspace) {
          await StorageService.deleteBookmark(this.currentWorkspace.id, bookmarkId);
          await this.loadWorkspaceData();
        }
      });
    });
  }

  private setupDragAndDrop(): void {
    const bookmarkItems = document.querySelectorAll('.bookmark-item');
    
    bookmarkItems.forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        this.isDragging = true;
        this.draggedElement = item as HTMLElement;
        (e.target as HTMLElement).classList.add('dragging');
        e.dataTransfer!.effectAllowed = 'move';
      });

      item.addEventListener('dragend', (e) => {
        (e.target as HTMLElement).classList.remove('dragging');
        document.querySelectorAll('.bookmark-item').forEach(el => {
          el.classList.remove('drag-over');
        });
        this.isDragging = false;
        this.draggedElement = null;
        this.dragOverElement = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        
        if (this.draggedElement && item !== this.draggedElement) {
          this.dragOverElement = item as HTMLElement;
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        
        if (this.draggedElement && this.currentWorkspace) {
          const list = document.getElementById('bookmarks-list');
          if (!list) return;

          const items = Array.from(list.querySelectorAll('.bookmark-item'));
          const draggedId = this.draggedElement.getAttribute('data-bookmark-id');
          const targetId = (item as HTMLElement).getAttribute('data-bookmark-id');
          
          if (draggedId && targetId && draggedId !== targetId) {
            const draggedIndex = items.indexOf(this.draggedElement);
            const targetIndex = items.indexOf(item as HTMLElement);
            
            if (draggedIndex < targetIndex) {
              list.insertBefore(this.draggedElement, (item as HTMLElement).nextSibling);
            } else {
              list.insertBefore(this.draggedElement, item as HTMLElement);
            }

            // Save new order
            const newOrder = Array.from(list.querySelectorAll('.bookmark-item')).map(
              el => el.getAttribute('data-bookmark-id')!
            );
            await StorageService.reorderBookmarks(this.currentWorkspace.id, newOrder);
            await this.loadWorkspaceData();
          }
        }
      });
    });
  }

  private async switchWorkspace(workspaceId: string): Promise<void> {
    await StorageService.setCurrentWorkspace(workspaceId);
    await this.loadWorkspaceData();
  }

  private async createWorkspace(): Promise<void> {
    const name = prompt('Enter workspace name:');
    if (!name || name.trim() === '') return;

    try {
      await StorageService.createWorkspace(name.trim());
      await this.loadWorkspaceData();
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert('Failed to create workspace');
    }
  }

  private async createBookmark(): Promise<void> {
    if (!this.currentWorkspace) return;

    const url = prompt('Enter bookmark URL:');
    if (!url || url.trim() === '') return;

    const title = prompt('Enter bookmark title (optional):') || new URL(url).hostname;

    try {
      const bookmark: Bookmark = {
        id: `bookmark-${Date.now()}`,
        title: title.trim(),
        url: url.trim(),
        position: this.currentWorkspace.bookmarks.length
      };
      await StorageService.addBookmark(this.currentWorkspace.id, bookmark);
      await this.loadWorkspaceData();
    } catch (error) {
      console.error('Error creating bookmark:', error);
      alert('Failed to create bookmark');
    }
  }

  private showWorkspaceMenu(workspaceId: string): void {
    // Simple menu for now - can be enhanced with a proper dropdown
    const action = prompt('Workspace actions:\n1. Rename\n2. Delete\n3. Settings\n\nEnter number:');
    
    if (action === '1') {
      this.renameWorkspace(workspaceId);
    } else if (action === '2') {
      this.deleteWorkspace(workspaceId);
    } else if (action === '3') {
      this.openSettings(workspaceId);
    }
  }

  private async renameWorkspace(workspaceId: string): Promise<void> {
    const data = await StorageService.getWorkspaceData();
    const workspace = data.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;

    const newName = prompt('Enter new workspace name:', workspace.name);
    if (!newName || newName.trim() === '') return;

    await StorageService.updateWorkspace(workspaceId, { name: newName.trim() });
    await this.loadWorkspaceData();
  }

  private async deleteWorkspace(workspaceId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this workspace?')) return;

    try {
      await StorageService.deleteWorkspace(workspaceId);
      await this.loadWorkspaceData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete workspace');
    }
  }

  private async toggleCollapse(): Promise<void> {
    if (!this.currentWorkspace) return;

    // Respect workspace setting: if not collapsible, do nothing
    if (!this.currentWorkspace.settings.collapsible) return;

    const newCollapsed = !this.currentWorkspace.settings.collapsed;
    await StorageService.updateWorkspaceSettings(this.currentWorkspace.id, { collapsed: newCollapsed });
    await this.loadWorkspaceData();
  }

  private updateCollapseButton(): void {
    const collapseBtn = document.getElementById('collapse-btn');
    if (!collapseBtn || !this.currentWorkspace) return;

    const settings = this.currentWorkspace.settings;

    // Hide collapse button entirely when panel is not configured as collapsible
    collapseBtn.style.display = settings.collapsible ? 'block' : 'none';

    const iconPackId = settings.iconPackId || 'minimalist';
    const iconPack = getIconPack(iconPackId);
    collapseBtn.innerHTML = settings.collapsed ? getIcon(iconPack, 'expandRight') : getIcon(iconPack, 'collapseLeft');
    
    const sidepanel = document.getElementById('sidepanel');
    if (sidepanel) {
      const isCollapsed = settings.collapsible && settings.collapsed;
      sidepanel.classList.toggle('collapsed', isCollapsed);
    }
  }

  private async openSettings(workspaceId?: string): Promise<void> {
    const targetWorkspaceId = workspaceId || this.currentWorkspace?.id;
    if (!targetWorkspaceId) return;

    const workspace = (await StorageService.getWorkspaceData()).workspaces.find(w => w.id === targetWorkspaceId);
    if (!workspace) return;

    const settingsPanel = document.getElementById('settings-panel');
    if (!settingsPanel) return;

    settingsPanel.innerHTML = `
      <div class="settings-header">
        <h3>Settings: ${workspace.name}</h3>
        <button id="close-settings-btn" class="icon-btn">${getIcon(getIconPack(workspace.settings.iconPackId || 'minimalist'), 'close')}</button>
      </div>
      <div class="settings-content">
        <div class="setting-group">
          <h4>Appearance</h4>
          <label>
            <input type="checkbox" id="rounded-corners" ${workspace.settings.roundedCorners ? 'checked' : ''}>
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
              <option value="fixed" ${workspace.settings.mode === 'fixed' ? 'selected' : ''}>Fixed</option>
              <option value="hovering" ${workspace.settings.mode === 'hovering' ? 'selected' : ''}>Hovering</option>
            </select>
          </label>
          <label>
            <input type="checkbox" id="collapsible" ${workspace.settings.collapsible ? 'checked' : ''}>
            Collapsible
          </label>
        </div>
        <div class="setting-group">
          <h4>Icons</h4>
          <label>
            Icon Pack:
            <select id="icon-pack">
              ${ICON_PACKS.map(pack => 
                `<option value="${pack.id}" ${(workspace.settings.iconPackId || 'minimalist') === pack.id ? 'selected' : ''}>${pack.name}</option>`
              ).join('')}
            </select>
          </label>
        </div>
        <div class="setting-group">
          <h4>On Close Behavior</h4>
          <label>
            <select id="on-close-behavior">
              <option value="continue" ${workspace.settings.onCloseBehavior === 'continue' ? 'selected' : ''}>Continue where left off</option>
              <option value="default" ${workspace.settings.onCloseBehavior === 'default' ? 'selected' : ''}>Open default tabs</option>
            </select>
          </label>
          <div id="default-tabs-section" style="margin-top: 10px;">
            <label>Default tabs (one URL per line):</label>
            <textarea id="default-tabs" rows="5" style="width: 100%;">${workspace.settings.defaultTabs.join('\n')}</textarea>
          </div>
        </div>
        <button id="save-settings-btn" class="save-btn">Save Settings</button>
      </div>
    `;

    settingsPanel.classList.remove('hidden');

    // Attach event listeners
    document.getElementById('close-settings-btn')?.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
    });

    document.getElementById('save-settings-btn')?.addEventListener('click', async () => {
      await this.saveSettings(targetWorkspaceId);
    });
  }

  private async saveSettings(workspaceId: string): Promise<void> {
    const current = this.currentWorkspace;

    const collapsible =
      (document.getElementById('collapsible') as HTMLInputElement)?.checked ?? true;

    const settings: Partial<WorkspaceSettings> = {
      roundedCorners: (document.getElementById('rounded-corners') as HTMLInputElement)?.checked ?? true,
      marginFromSide: parseInt((document.getElementById('margin-side') as HTMLInputElement)?.value || '10'),
      marginTop: parseInt((document.getElementById('margin-top') as HTMLInputElement)?.value || '10'),
      marginBottom: parseInt((document.getElementById('margin-bottom') as HTMLInputElement)?.value || '10'),
      width: parseInt((document.getElementById('panel-width') as HTMLInputElement)?.value || '300'),
      mode: (document.getElementById('panel-mode') as HTMLSelectElement)?.value as 'fixed' | 'hovering',
      collapsible,
      // If collapsibility is turned off, force panel to expanded state
      collapsed: collapsible ? (current?.settings.collapsed ?? false) : false,
      onCloseBehavior: (document.getElementById('on-close-behavior') as HTMLSelectElement)?.value as 'continue' | 'default',
      defaultTabs: (document.getElementById('default-tabs') as HTMLTextAreaElement)?.value
        .split('\n')
        .map(url => url.trim())
        .filter(url => url !== ''),
      iconPackId: (document.getElementById('icon-pack') as HTMLSelectElement)?.value || 'minimalist'
    };
    // Hovering mode always uses collapsible panel
    if (settings.mode === 'hovering') settings.collapsible = true;

    await StorageService.updateWorkspaceSettings(workspaceId, settings);
    await this.loadWorkspaceData();
    
    // Update icons immediately after saving
    this.updateIcons();
    
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
      settingsPanel.classList.add('hidden');
    }
  }

  private applyWorkspaceStyles(): void {
    if (!this.currentWorkspace) return;

    const sidepanel = document.getElementById('sidepanel');
    if (!sidepanel) return;

    const settings = this.currentWorkspace.settings;
    const root = document.documentElement;

    // Apply CSS custom properties
    root.style.setProperty('--panel-width', `${settings.width}px`);
    root.style.setProperty('--margin-side', `${settings.marginFromSide}px`);
    root.style.setProperty('--margin-top', `${settings.marginTop}px`);
    root.style.setProperty('--margin-bottom', `${settings.marginBottom}px`);

    // Apply mode
    sidepanel.classList.toggle('mode-fixed', settings.mode === 'fixed');
    sidepanel.classList.toggle('mode-hovering', settings.mode === 'hovering');
    sidepanel.classList.toggle('rounded-corners', settings.roundedCorners);
    sidepanel.classList.toggle('collapsed', settings.collapsed);
    sidepanel.classList.toggle('collapsible', settings.collapsible);
  }

}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SidePanelManager();
});
