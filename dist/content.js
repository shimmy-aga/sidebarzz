// Workspace Manager Content Script
// Injects sidebar into web pages for workspace, bookmark, and tab management
// This script runs on ALL pages including chrome:// pages via programmatic injection

// Prevent duplicate script execution - wrap everything in IIFE
(function() {
'use strict';

// Check if already loaded - exit early to prevent duplicate declarations
if (window.workspaceManagerContentScriptLoaded) {
  // Script already loaded
  if (document.getElementById('workspace-manager-sidebar')) {
    // Sidebar exists, nothing to do - exit immediately
    return;
  }
  // Sidebar missing but script loaded - will recreate below
}
window.workspaceManagerContentScriptLoaded = true;

// Declare constants using var to allow redeclaration (prevents duplicate declaration error)
// Check if already declared to avoid errors when script runs multiple times
if (typeof window.__workspaceManagerGRID_CELL_SIZE === 'undefined') {
  window.__workspaceManagerGRID_CELL_SIZE = 48;
  window.__workspaceManagerSIDEBAR_WIDTH = 52;
  window.__workspaceManagerGRID_COLUMNS = 1;
}
var GRID_CELL_SIZE = window.__workspaceManagerGRID_CELL_SIZE; // 40px icon + 8px gap
var SIDEBAR_WIDTH = window.__workspaceManagerSIDEBAR_WIDTH;
var GRID_COLUMNS = window.__workspaceManagerGRID_COLUMNS; // Single column layout

// Default settings
const DEFAULT_SETTINGS = {
  roundedCorners: true,
  marginFromSide: 0,
  marginTop: 0,
  marginBottom: 0,
  width: 52,
  borderRadius: 0,
  iconBorderRadius: 25,
  position: 'left',
  alignment: 'top',
  backgroundColor: '#252526',
  iconBackgroundColor: '#2d2d2d',
  iconTextColor: '#d4d4d4',
  borderColor: '#3e3e42',
  accentColor: '#007acc',
  themeId: 'dark',
  customThemes: [],
  mode: 'fixed',
  collapsible: false,
  collapsed: false,
  onCloseBehavior: 'continue',
  defaultTabs: []
};

// Preset themes
const PRESET_THEMES = [
  {
    id: 'dark',
    name: 'Dark',
    backgroundColor: '#252526',
    iconBackgroundColor: '#2d2d2d',
    iconTextColor: '#d4d4d4',
    borderColor: '#3e3e42',
    accentColor: '#007acc'
  },
  {
    id: 'light',
    name: 'Light',
    backgroundColor: '#ffffff',
    iconBackgroundColor: '#f3f3f3',
    iconTextColor: '#333333',
    borderColor: '#e0e0e0',
    accentColor: '#007acc'
  },
  {
    id: 'blue',
    name: 'Blue',
    backgroundColor: '#1e3a5f',
    iconBackgroundColor: '#2a4a7a',
    iconTextColor: '#e0e8f0',
    borderColor: '#3a5a8a',
    accentColor: '#4a9eff'
  },
  {
    id: 'green',
    name: 'Green',
    backgroundColor: '#1e3f1e',
    iconBackgroundColor: '#2a5a2a',
    iconTextColor: '#e0f0e0',
    borderColor: '#3a6a3a',
    accentColor: '#4aff4a'
  },
  {
    id: 'purple',
    name: 'Purple',
    backgroundColor: '#3d1e3d',
    iconBackgroundColor: '#5a2a5a',
    iconTextColor: '#f0e0f0',
    borderColor: '#6a3a6a',
    accentColor: '#aa4aff'
  },
  {
    id: 'orange',
    name: 'Orange',
    backgroundColor: '#3d2e1e',
    iconBackgroundColor: '#5a4a2a',
    iconTextColor: '#f0e8e0',
    borderColor: '#6a5a3a',
    accentColor: '#ff8a4a'
  }
];

// Current workspace settings
let currentSettings = { ...DEFAULT_SETTINGS };

const DEFAULT_BOOKMARKS = [
  { id: '1', title: 'GitHub', url: 'https://github.com' },
  { id: '2', title: 'Stack Overflow', url: 'https://stackoverflow.com' }
];

const DEFAULT_WORKSPACES = [
  { id: 'default', name: 'Default', gridRow: 0, gridCol: 0 }
];

// Global variables
let currentBookmarks = [];
let currentWorkspaces = [];
let sidebarElement = null;
let sidebarCollapsed = false;
let isDragging = false;
let dragJustEnded = false;

// Helper function to merge settings with defaults
function mergeSettings(workspaceSettings) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...workspaceSettings,
    // Force minimum values for margins and width
    marginFromSide: workspaceSettings?.marginFromSide !== undefined ? workspaceSettings.marginFromSide : DEFAULT_SETTINGS.marginFromSide,
    marginTop: workspaceSettings?.marginTop !== undefined ? workspaceSettings.marginTop : DEFAULT_SETTINGS.marginTop,
    marginBottom: workspaceSettings?.marginBottom !== undefined ? workspaceSettings.marginBottom : DEFAULT_SETTINGS.marginBottom,
    // Ensure width is within 40-80px range
    width: Math.max(40, Math.min(80, workspaceSettings?.width || DEFAULT_SETTINGS.width)),
    // Force border radius defaults
    borderRadius: workspaceSettings?.borderRadius !== undefined ? workspaceSettings.borderRadius : DEFAULT_SETTINGS.borderRadius,
    iconBorderRadius: workspaceSettings?.iconBorderRadius !== undefined ? workspaceSettings.iconBorderRadius : DEFAULT_SETTINGS.iconBorderRadius,
    // Force position and alignment
    position: workspaceSettings?.position || DEFAULT_SETTINGS.position,
    alignment: workspaceSettings?.alignment || DEFAULT_SETTINGS.alignment
  };
  // Ensure accent color is set
  if (!merged.accentColor) {
    merged.accentColor = '#007acc';
  }
  // Preserve custom themes
  if (workspaceSettings?.customThemes) {
    merged.customThemes = workspaceSettings.customThemes;
  }
  // Apply theme if one is selected
  if (merged.themeId && merged.themeId !== 'custom') {
    let theme = PRESET_THEMES.find(t => t.id === merged.themeId);
    if (!theme && merged.customThemes) {
      theme = merged.customThemes.find(t => t.id === merged.themeId);
    }
    if (theme) {
      merged.backgroundColor = theme.backgroundColor;
      merged.iconBackgroundColor = theme.iconBackgroundColor;
      merged.iconTextColor = theme.iconTextColor;
      merged.borderColor = theme.borderColor;
      merged.accentColor = theme.accentColor;
    }
  }
  return merged;
}

// Apply CSS styles based on settings
function applySidebarStyles(sidebar, settings) {
  if (!sidebar) return;
  
  const s = settings;
  const isCollapsed = sidebar.classList.contains('wm-auto-collapsed');
  
  // Apply width - but don't override if collapsed (handled by setCollapsedState)
  if (!isCollapsed) {
    // Always set width directly - CSS transitions will handle smooth changes
    sidebar.style.width = s.width + 'px';
    sidebar.style.minWidth = s.width + 'px';
    sidebar.style.maxWidth = s.width + 'px';
  }
  // When collapsed, don't touch width/position - setCollapsedState handles it
  
  // Apply position classes (preserve other classes like wm-auto-collapsed, hidden, etc.)
  sidebar.classList.remove('wm-sidebar-left', 'wm-sidebar-right');
  sidebar.classList.add(`wm-sidebar-${s.position}`);
  
  // Apply mode class
  if (s.mode === 'hovering') {
    sidebar.classList.add('wm-mode-hovering');
  } else {
    sidebar.classList.remove('wm-mode-hovering');
  }
  
  // Apply border radius
  sidebar.style.borderRadius = s.borderRadius + 'px';
  
  // Apply colors
  sidebar.style.backgroundColor = s.backgroundColor;
  sidebar.style.borderColor = s.borderColor;
  
  // Apply margins based on mode
  if (s.mode === 'hovering') {
    // Don't set position styles if collapsed - let CSS handle the transition
    // Only set top/bottom and height
    sidebar.style.top = s.marginTop + 'px';
    sidebar.style.bottom = s.marginBottom + 'px';
    sidebar.style.height = `calc(100vh - ${s.marginTop + s.marginBottom}px)`;
    
    if (!isCollapsed) {
      // Only set position when NOT collapsed
      // Clear both sides first to avoid conflicts
      sidebar.style.left = 'auto';
      sidebar.style.right = 'auto';
      if (s.position === 'left') {
        sidebar.style.left = s.marginFromSide + 'px';
        sidebar.style.marginLeft = '';
        sidebar.style.marginRight = '';
      } else {
        sidebar.style.right = s.marginFromSide + 'px';
        sidebar.style.marginLeft = '';
        sidebar.style.marginRight = '';
      }
    } else {
      // When collapsed, don't touch width/position styles at all
      // They're managed by setCollapsedState for smooth transitions
      // Only clear margins to avoid conflicts
      sidebar.style.marginLeft = '';
      sidebar.style.marginRight = '';
    }
    
    // Don't affect viewport in hovering mode
    document.body.style.paddingLeft = '0';
    document.body.style.paddingRight = '0';
  } else {
    // Fixed mode: no margins, affects viewport
    if (s.position === 'left') {
      sidebar.style.left = '0';
      sidebar.style.right = 'auto';
    } else {
      sidebar.style.right = '0';
      sidebar.style.left = 'auto';
    }
    sidebar.style.top = '0';
    sidebar.style.bottom = '0';
    sidebar.style.height = '100vh';
    // Affect viewport - but not if collapsed
    if (!isCollapsed) {
      document.body.style.paddingLeft = s.position === 'left' ? s.width + 'px' : '0';
      document.body.style.paddingRight = s.position === 'right' ? s.width + 'px' : '0';
    } else {
      document.body.style.paddingLeft = '0';
      document.body.style.paddingRight = '0';
    }
  }
  
  // Apply icon styles
  const styleId = 'wm-dynamic-styles';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  
  const iconSize = Math.max(18, Math.min(48, s.width * 0.65)); // Scale icon size with width (18-48px)
  
  const accentColor = s.accentColor || '#007acc';
  
  styleEl.textContent = `
    :root {
      --wm-accent-color: ${accentColor};
      --wm-sidebar-width: ${s.width}px;
    }
    #workspace-manager-sidebar .wm-icon {
      width: ${iconSize}px !important;
      height: ${iconSize}px !important;
      border-radius: ${s.iconBorderRadius}px !important;
      background-color: ${s.iconBackgroundColor} !important;
      color: ${s.iconTextColor} !important;
      font-size: ${iconSize * 0.5}px !important;
    }
    #workspace-manager-sidebar .wm-icon img {
      width: ${iconSize * 0.6}px !important;
      height: ${iconSize * 0.6}px !important;
    }
    #workspace-manager-sidebar .wm-bookmarks.wm-grid-container {
      align-content: ${s.alignment === 'top' ? 'start' : 'end'};
      justify-content: ${s.alignment === 'top' ? 'flex-start' : 'flex-end'};
    }
  `;
  
  // Apply panel styles (settings panel, etc.)
  applyPanelStyles(s);
  
  // Update accent color styles
  updateAccentColorStyles(accentColor);
}

// Helper function to lighten color
function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Helper function to darken color
function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - percent);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
  const b = Math.max(0, (num & 0x0000FF) - percent);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Update accent color throughout the UI
function updateAccentColorStyles(accentColor) {
  const accentStyleId = 'wm-accent-color-styles';
  let accentStyleEl = document.getElementById(accentStyleId);
  if (!accentStyleEl) {
    accentStyleEl = document.createElement('style');
    accentStyleEl.id = accentStyleId;
    document.head.appendChild(accentStyleEl);
  }
  
  const s = currentSettings;
  const lighterAccent = lightenColor(accentColor, 30);
  const darkerAccent = darkenColor(accentColor, 20);
  const iconBgLight = lightenColor(s.iconBackgroundColor || '#2d2d2d', 15);
  
  // Convert hex to RGB for rgba
  const r = parseInt(accentColor.slice(1, 3), 16);
  const g = parseInt(accentColor.slice(3, 5), 16);
  const b = parseInt(accentColor.slice(5, 7), 16);
  
  accentStyleEl.textContent = `
    /* Active/focused states use accent color */
    #workspace-manager-sidebar .wm-icon.active {
      background: ${accentColor} !important;
      border-color: ${darkerAccent} !important;
    }
    
    /* Hover effects - subtle, use lighter version of current background */
    #workspace-manager-sidebar .wm-icon:not(.active):hover {
      background: ${iconBgLight} !important;
      transform: scale(1.05);
    }
    
    #workspace-manager-sidebar .wm-icon.active:hover {
      background: ${lighterAccent} !important;
      border-color: ${accentColor} !important;
    }
    
    /* Slider thumbs use accent color */
    .wm-slider::-webkit-slider-thumb {
      background: linear-gradient(135deg, ${accentColor} 0%, ${darkerAccent} 100%) !important;
    }
    
    .wm-slider::-moz-range-thumb {
      background: linear-gradient(135deg, ${accentColor} 0%, ${darkerAccent} 100%) !important;
    }
    
    /* Slider value display */
    .wm-slider-value {
      color: ${accentColor} !important;
    }
    
    /* Radio/checkbox accent */
    .wm-radio-option input[type="radio"],
    .wm-checkbox-option input[type="checkbox"] {
      accent-color: ${accentColor} !important;
    }
    
    .wm-radio-option:has(input[type="radio"]:checked),
    .wm-checkbox-option:has(input[type="checkbox"]:checked) {
      border-color: ${accentColor} !important;
      background: rgba(${r}, ${g}, ${b}, 0.2) !important;
    }
    
    .wm-radio-option:has(input[type="radio"]:checked) span,
    .wm-checkbox-option:has(input[type="checkbox"]:checked) span {
      color: ${accentColor} !important;
    }
    
    /* Add button hover */
    .wm-add-btn:hover {
      background: linear-gradient(135deg, ${accentColor} 0%, ${darkerAccent} 100%) !important;
    }
    
    /* Form inputs focus */
    .wm-form-input:focus {
      border-color: ${accentColor} !important;
      box-shadow: 0 0 0 2px rgba(${r}, ${g}, ${b}, 0.2) !important;
    }
    
    /* Color picker hover */
    .wm-setting-item input[type="color"]:hover {
      border-color: ${accentColor} !important;
    }
    
    /* Settings button hover - same as other icons */
    #workspace-manager-sidebar .wm-settings-btn:hover {
      background: ${iconBgLight} !important;
      transform: scale(1.05);
    }
  `;
}

// Apply styles to panels (settings, bookmark, workspace panels) relative to sidebar
function applyPanelStyles(settings) {
  const s = settings;
  const sidebar = sidebarElement;
  if (!sidebar) return;
  
  // Function to update panel positions and styles
  const updatePanelStyles = () => {
    if (!sidebar) return;
    
    const sidebarRect = sidebar.getBoundingClientRect();
    const sidebarLeft = sidebarRect.left;
    const sidebarRight = sidebarRect.right;
    const sidebarTop = sidebarRect.top;
    const sidebarHeight = sidebarRect.height;
    
    // Calculate panel position based on sidebar position
    let panelLeft, panelRight;
    if (s.position === 'left') {
      // Panel appears to the right of sidebar
      panelLeft = sidebarRight + 10 + 'px'; // 10px gap from sidebar
      panelRight = 'auto';
    } else {
      // Panel appears to the left of sidebar
      // Panel's right edge should be 10px to the left of sidebar's left edge
      // right property is distance from right edge of window
      panelRight = (window.innerWidth - sidebarLeft + 10) + 'px';
      panelLeft = 'auto';
    }
    
    // Panel height and top should match sidebar (accounting for margins)
    let panelTop, panelHeight;
    if (s.mode === 'hovering') {
      panelTop = sidebarTop + 'px';
      panelHeight = sidebarHeight + 'px';
    } else {
      panelTop = '0px';
      panelHeight = '100vh';
    }
    
    // Apply styles directly to panel elements (including form modals, confirm modals, and icon picker)
    const panels = [
      document.getElementById('wm-settings-panel'),
      document.getElementById('wm-bookmark-panel'),
      document.getElementById('wm-workspace-panel'),
      document.getElementById('wm-form-modal'),
      document.getElementById('wm-confirm-modal'),
      document.getElementById('wm-icon-picker-modal')
    ].filter(p => p !== null);
    
    panels.forEach(panelOverlay => {
      const panel = panelOverlay.querySelector('.wm-panel');
      if (!panel) return;
      
      // Apply positioning
      panel.style.left = panelLeft;
      panel.style.right = panelRight;
      panel.style.top = panelTop;
      panel.style.height = panelHeight;
      
      // Apply styling to match sidebar
      panel.style.borderRadius = s.borderRadius + 'px';
      panel.style.backgroundColor = s.backgroundColor;
      panel.style.borderColor = s.borderColor;
      
      // Apply border based on position
      if (s.position === 'left') {
        panel.style.borderRight = '1px solid ' + s.borderColor;
        panel.style.borderLeft = 'none';
      } else {
        panel.style.borderLeft = '1px solid ' + s.borderColor;
        panel.style.borderRight = 'none';
      }
      
      // Apply animation class based on position
      panelOverlay.classList.remove('wm-slide-from-left', 'wm-slide-from-right');
      if (s.position === 'left') {
        panelOverlay.classList.add('wm-slide-from-left');
      } else {
        panelOverlay.classList.add('wm-slide-from-right');
      }
    });
  };
  
  // Update immediately
  updatePanelStyles();
  
  // Store update function globally so it can be called from anywhere
  window.wmPanelPositionUpdater = updatePanelStyles;
  
  // Update accent color styles
  updateAccentColorStyles(s.accentColor || '#007acc');
  
  // Update on window resize and when sidebar moves
  // Use requestAnimationFrame for smooth updates during scroll
  let rafId = null;
  let updateScheduled = false;
  const scheduleUpdate = () => {
    if (updateScheduled) return;
    updateScheduled = true;
    rafId = requestAnimationFrame(() => {
      updatePanelStyles();
      updateScheduled = false;
    });
  };
  
  // Debounced version for resize events
  let resizeTimeout = null;
  const debouncedUpdate = () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updatePanelStyles();
    }, 100);
  };
  
  // Remove old handlers if they exist
  if (window.wmPanelResizeHandler) {
    window.removeEventListener('resize', window.wmPanelResizeHandler);
  }
  if (window.wmPanelScrollHandler) {
    window.removeEventListener('scroll', window.wmPanelScrollHandler, true);
    document.removeEventListener('scroll', window.wmPanelScrollHandler, true);
    document.documentElement.removeEventListener('scroll', window.wmPanelScrollHandler, true);
    document.body.removeEventListener('scroll', window.wmPanelScrollHandler, true);
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }
  
  // Store handlers globally
  window.wmPanelResizeHandler = debouncedUpdate;
  window.wmPanelScrollHandler = scheduleUpdate;
  
  // Attach resize handler
  window.addEventListener('resize', debouncedUpdate, { passive: true });
  
  // Attach scroll handlers to multiple targets for better coverage
  // Use requestAnimationFrame for smooth scroll updates
  window.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
  document.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
  document.documentElement.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
  document.body.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
  
  // Use MutationObserver to detect sidebar position changes
  if (window.MutationObserver) {
    // Remove old observer if it exists
    if (window.wmPanelSidebarObserver) {
      window.wmPanelSidebarObserver.disconnect();
    }
    
    window.wmPanelSidebarObserver = new MutationObserver(() => {
      debouncedUpdate();
    });
    window.wmPanelSidebarObserver.observe(sidebar, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }
  
  // Also observe when any panel becomes active
  const observePanelActive = (panel) => {
    if (!panel) return;
    const panelObserver = new MutationObserver(() => {
      if (panel.classList.contains('active')) {
        // Update immediately when panel becomes active
        requestAnimationFrame(() => {
          updatePanelStyles();
        });
      }
    });
    panelObserver.observe(panel, {
      attributes: true,
      attributeFilter: ['class']
    });
    return panelObserver;
  };
  
  // Observe all panels
  const settingsPanel = document.getElementById('wm-settings-panel');
  const bookmarkPanel = document.getElementById('wm-bookmark-panel');
  const workspacePanel = document.getElementById('wm-workspace-panel');
  const formModal = document.getElementById('wm-form-modal');
  const confirmModal = document.getElementById('wm-confirm-modal');
  const iconPickerModal = document.getElementById('wm-icon-picker-modal');
  
  if (window.wmPanelActiveObservers) {
    window.wmPanelActiveObservers.forEach(obs => obs.disconnect());
  }
  window.wmPanelActiveObservers = [
    observePanelActive(settingsPanel),
    observePanelActive(bookmarkPanel),
    observePanelActive(workspacePanel),
    observePanelActive(formModal),
    observePanelActive(confirmModal),
    observePanelActive(iconPickerModal)
  ].filter(obs => obs !== undefined);
}

// Grid positioning functions
function calculateGridPosition(index) {
  return {
    row: Math.floor(index / GRID_COLUMNS),
    col: index % GRID_COLUMNS
  };
}

function indexToGridPosition(index) {
  return { row: index, col: 0 };
}

function gridPositionToIndex(row, col) {
  return row * GRID_COLUMNS + col;
}

function migrateToGridPositions(items) {
  items.forEach((item, index) => {
    if (item.gridRow === undefined || item.gridCol === undefined) {
      const position = item.position !== undefined ? item.position : index;
      const gridPos = indexToGridPosition(position);
      item.gridRow = gridPos.row;
      item.gridCol = gridPos.col;
    }
  });
}

function findNearestFreeCell(items, targetRow, targetCol, excludeId) {
  const occupied = new Set();
  items.forEach(item => {
    if (item.id !== excludeId && item.gridRow !== undefined && item.gridCol !== undefined) {
      occupied.add(`${item.gridRow},${item.gridCol}`);
    }
  });

  if (!occupied.has(`${targetRow},${targetCol}`)) {
    return { row: targetRow, col: targetCol };
  }

  for (let radius = 1; radius < 100; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) + Math.abs(dc) === radius) {
          const checkRow = targetRow + dr;
          const checkCol = targetCol + dc;
          if (checkRow >= 0 && checkCol >= 0 && checkCol < GRID_COLUMNS) {
            if (!occupied.has(`${checkRow},${checkCol}`)) {
              return { row: checkRow, col: checkCol };
            }
          }
        }
      }
    }
  }

  const maxRow = Math.max(...items.map(item => item.gridRow || 0), -1);
  return { row: maxRow + 1, col: 0 };
}

function compactGridPositions(items) {
  if (!items || items.length === 0) return;
  
  const sortedItems = [...items].sort((a, b) => {
    const indexA = gridPositionToIndex(a.gridRow || 0, a.gridCol || 0);
    const indexB = gridPositionToIndex(b.gridRow || 0, b.gridCol || 0);
    return indexA - indexB;
  });
  
  sortedItems.forEach((item, index) => {
    const gridPos = indexToGridPosition(index);
    item.gridRow = gridPos.row;
    item.gridCol = gridPos.col;
  });
}


// Form modal functions
function openFormModal(title, fields, onSubmit, onCancel) {
  // Close all other modals/panels first
  closeAllModals();
  // Cancel any pending collapse
  cancelPendingCollapse();
  
  let modal = document.getElementById('wm-form-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wm-form-modal';
    modal.className = 'wm-panel-overlay';
    modal.innerHTML = `
      <div class="wm-panel">
        <div class="wm-panel-header">
          <h2 class="wm-modal-title"></h2>
          <button class="wm-panel-close">&times;</button>
        </div>
        <div class="wm-panel-content">
          <div class="wm-form-content"></div>
        </div>
        <div class="wm-modal-footer" style="padding: 20px; border-top: 1px solid #3e3e42; display: flex; gap: 10px; justify-content: flex-end;">
          <button class="wm-form-cancel" style="padding: 8px 16px; background: #3e3e42; border: none; border-radius: 4px; color: #d4d4d4; cursor: pointer;">Cancel</button>
          <button class="wm-form-submit" style="padding: 8px 16px; background: #007acc; border: none; border-radius: 4px; color: #ffffff; cursor: pointer;">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('.wm-panel-close').addEventListener('click', () => closeFormModal());
  }
  
  modal.querySelector('.wm-modal-title').textContent = title;
  
  const formContent = modal.querySelector('.wm-form-content');
  formContent.innerHTML = fields.map((field, idx) => {
    if (field.type === 'select') {
      return `
        <div class="wm-form-group">
          <label for="wm-form-field-${idx}" class="wm-form-label">${field.label}</label>
          <select id="wm-form-field-${idx}" class="wm-form-input">
            ${field.options ? field.options.map(opt => 
              `<option value="${opt.value}" ${opt.value === field.value ? 'selected' : ''}>${opt.label}</option>`
            ).join('') : ''}
          </select>
        </div>
      `;
    } else {
      return `
        <div class="wm-form-group">
          <label for="wm-form-field-${idx}" class="wm-form-label">${field.label}</label>
          <input 
            type="${field.type || 'text'}" 
            id="wm-form-field-${idx}" 
            class="wm-form-input" 
            placeholder="${field.placeholder || ''}"
            value="${field.value || ''}"
          >
        </div>
      `;
    }
  }).join('');
  
  const submitBtn = modal.querySelector('.wm-form-submit');
  const cancelBtn = modal.querySelector('.wm-form-cancel');
  
  submitBtn.onclick = () => {
    const values = Array.from(formContent.querySelectorAll('.wm-form-input, select')).map(input => input.value);
    closeFormModal();
    if (onSubmit) onSubmit(values);
  };
  
  cancelBtn.onclick = () => {
    closeFormModal();
    if (onCancel) onCancel();
  };
  
  // Apply panel positioning and styling before showing
  if (window.wmPanelPositionUpdater) {
    window.wmPanelPositionUpdater();
    // Small delay to ensure styles are applied before animation
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  } else {
    modal.classList.add('active');
  }
  const firstInput = formContent.querySelector('.wm-form-input');
  if (firstInput) firstInput.focus();
}

// Helper function to close all modals/panels (except sidebar)
function closeAllModals() {
  const modalsToClose = [
    'wm-settings-panel',
    'wm-form-modal',
    'wm-confirm-modal',
    'wm-icon-picker-modal'
  ];
  
  modalsToClose.forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (panel && panel.classList.contains('active')) {
      closePanel(panelId);
    }
  });
}

// Helper function to close panels/modals with slide-out animation
function closePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.classList.add('closing');
    setTimeout(() => {
      panel.classList.remove('active', 'closing');
    }, 300);
  }
}

function closeFormModal() {
  closePanel('wm-form-modal');
}

function openConfirmModal(title, message, onConfirm) {
  // Close all other modals/panels first
  closeAllModals();
  
  let modal = document.getElementById('wm-confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wm-confirm-modal';
    modal.className = 'wm-panel-overlay';
    modal.innerHTML = `
      <div class="wm-panel">
        <div class="wm-panel-header">
          <h2 class="wm-confirm-title"></h2>
          <button class="wm-panel-close">&times;</button>
        </div>
        <div class="wm-panel-content">
          <p class="wm-confirm-message"></p>
        </div>
        <div class="wm-modal-footer" style="padding: 20px; border-top: 1px solid #3e3e42; display: flex; gap: 10px; justify-content: flex-end;">
          <button class="wm-confirm-cancel" style="padding: 8px 16px; background: #3e3e42; border: none; border-radius: 4px; color: #d4d4d4; cursor: pointer;">Cancel</button>
          <button class="wm-confirm-ok" style="padding: 8px 16px; background: #007acc; border: none; border-radius: 4px; color: #ffffff; cursor: pointer;">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('.wm-confirm-cancel').addEventListener('click', () => {
      closePanel('wm-confirm-modal');
    });
    modal.querySelector('.wm-panel-close').addEventListener('click', () => {
      closePanel('wm-confirm-modal');
    });
  }
  
  modal.querySelector('.wm-confirm-title').textContent = title;
  modal.querySelector('.wm-confirm-message').textContent = message;
  modal.querySelector('.wm-confirm-ok').onclick = () => {
    closePanel('wm-confirm-modal');
    if (onConfirm) onConfirm();
  };
  
  // Apply panel positioning and styling before showing
  if (window.wmPanelPositionUpdater) {
    window.wmPanelPositionUpdater();
    // Small delay to ensure styles are applied before animation
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  } else {
    modal.classList.add('active');
  }
}

// Favicon helpers: Chrome _favicon (best) -> Google s2 -> origin /favicon.ico -> placeholder
function getChromeFaviconUrl(url) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    try {
      const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
      faviconUrl.searchParams.set('pageUrl', url);
      faviconUrl.searchParams.set('size', '32');
      return faviconUrl.toString();
    } catch (e) {
      return '';
    }
  }
  return '';
}

function getGoogleFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(urlObj.hostname) + '&sz=32';
  } catch (e) {
    return '';
  }
}

function getOriginFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + '/favicon.ico';
  } catch (e) {
    return '';
  }
}

function getFaviconPlaceholder() {
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="%23333"/></svg>';
}

// step: 0 = Chrome, 1 = Google, 2 = origin, 3 = placeholder
function getFaviconSource(url, step) {
  if (!url) return getFaviconPlaceholder();
  switch (step) {
    case 0: {
      const u = getChromeFaviconUrl(url);
      return u || getFaviconSource(url, 1);
    }
    case 1: {
      const u = getGoogleFaviconUrl(url);
      return u || getFaviconSource(url, 2);
    }
    case 2: {
      const u = getOriginFaviconUrl(url);
      return u || getFaviconPlaceholder();
    }
    case 3:
    default:
      return getFaviconPlaceholder();
  }
}

function escapeFaviconAttr(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline onerror calls this; try next source in chain (Chrome -> Google -> origin -> placeholder)
function wmFaviconFallback(img) {
  var url = img.getAttribute('data-favicon-url');
  var step = parseInt(img.getAttribute('data-favicon-attempt') || '0', 10) + 1;
  img.setAttribute('data-favicon-attempt', String(step));
  img.src = getFaviconSource(url, step);
  if (step >= 3) {
    img.onerror = null;
  }
}

// Expose for inline onerror from bookmark icons
window.wmFaviconFallback = wmFaviconFallback;

// Legacy: first source (Chrome or Google) for contexts that only set src once
function getFaviconUrl(url) {
  return getFaviconSource(url, 0);
}

// Settings panel
function renderSettingsPanel() {
  const settingsPanel = document.getElementById('wm-settings-panel');
  if (!settingsPanel) return;

  if (!chrome || !chrome.storage || !chrome.storage.local) {
    return;
  }
  
  // Populate settings from currentSettings
  const s = currentSettings;
  
  // Mode
  const modeInput = settingsPanel.querySelector(`input[name="wm-mode"][value="${s.mode}"]`);
  if (modeInput) modeInput.checked = true;
  
  // Position
  const positionInput = settingsPanel.querySelector(`input[name="wm-position"][value="${s.position}"]`);
  if (positionInput) positionInput.checked = true;
  
  // Width
  const widthSlider = settingsPanel.querySelector('#wm-width-slider');
  const widthValue = settingsPanel.querySelector('#wm-width-value');
  if (widthSlider) {
    widthSlider.value = s.width;
    if (widthValue) widthValue.textContent = s.width + 'px';
  }
  
  // Margins
  const marginSide = settingsPanel.querySelector('#wm-margin-side');
  const marginSideValue = settingsPanel.querySelector('#wm-margin-side-value');
  if (marginSide) {
    marginSide.value = s.marginFromSide;
    if (marginSideValue) marginSideValue.textContent = s.marginFromSide + 'px';
  }
  const marginTop = settingsPanel.querySelector('#wm-margin-top');
  const marginTopValue = settingsPanel.querySelector('#wm-margin-top-value');
  if (marginTop) {
    marginTop.value = s.marginTop;
    if (marginTopValue) marginTopValue.textContent = s.marginTop + 'px';
  }
  const marginBottom = settingsPanel.querySelector('#wm-margin-bottom');
  const marginBottomValue = settingsPanel.querySelector('#wm-margin-bottom-value');
  if (marginBottom) {
    marginBottom.value = s.marginBottom;
    if (marginBottomValue) marginBottomValue.textContent = s.marginBottom + 'px';
  }
  
  // Border radius
  const borderRadius = settingsPanel.querySelector('#wm-border-radius');
  const borderRadiusValue = settingsPanel.querySelector('#wm-border-radius-value');
  if (borderRadius) {
    borderRadius.value = s.borderRadius;
    if (borderRadiusValue) borderRadiusValue.textContent = s.borderRadius + 'px';
  }
  const iconBorderRadius = settingsPanel.querySelector('#wm-icon-border-radius');
  const iconBorderRadiusValue = settingsPanel.querySelector('#wm-icon-border-radius-value');
  if (iconBorderRadius) {
    iconBorderRadius.value = s.iconBorderRadius;
    if (iconBorderRadiusValue) iconBorderRadiusValue.textContent = s.iconBorderRadius + 'px';
  }
  
  // Theme grid
  const themeGrid = settingsPanel.querySelector('#wm-theme-grid');
  if (themeGrid) {
    themeGrid.innerHTML = '';
    
    // Add "Custom Colors" option
    const customThemeCard = document.createElement('div');
    customThemeCard.className = 'wm-theme-card';
    customThemeCard.dataset.themeId = 'custom';
    if (s.themeId === 'custom' || !s.themeId) {
      customThemeCard.classList.add('active');
    }
    customThemeCard.innerHTML = `
      <div class="wm-theme-preview" style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px;">
        <div style="height: 20px; background: ${s.backgroundColor}; border-radius: 4px 4px 0 0;"></div>
        <div style="height: 20px; background: ${s.iconBackgroundColor};"></div>
        <div style="height: 20px; background: ${s.accentColor}; border-radius: 0 0 4px 4px;"></div>
      </div>
      <div style="text-align: center; font-size: 12px; color: #d4d4d4;">Custom</div>
    `;
    themeGrid.appendChild(customThemeCard);
    
    // Add preset themes
    PRESET_THEMES.forEach(theme => {
      const themeCard = document.createElement('div');
      themeCard.className = 'wm-theme-card';
      themeCard.dataset.themeId = theme.id;
      if (s.themeId === theme.id) {
        themeCard.classList.add('active');
      }
      themeCard.innerHTML = `
        <div class="wm-theme-preview" style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px;">
          <div style="height: 20px; background: ${theme.backgroundColor}; border-radius: 4px 4px 0 0;"></div>
          <div style="height: 20px; background: ${theme.iconBackgroundColor};"></div>
          <div style="height: 20px; background: ${theme.accentColor}; border-radius: 0 0 4px 4px;"></div>
        </div>
        <div style="text-align: center; font-size: 12px; color: #d4d4d4;">${theme.name}</div>
      `;
      themeGrid.appendChild(themeCard);
    });
    
    // Add custom themes
    if (s.customThemes && s.customThemes.length > 0) {
      s.customThemes.forEach(theme => {
        const themeCard = document.createElement('div');
        themeCard.className = 'wm-theme-card';
        themeCard.dataset.themeId = theme.id;
        if (s.themeId === theme.id) {
          themeCard.classList.add('active');
        }
        themeCard.innerHTML = `
          <div class="wm-theme-preview" style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px;">
            <div style="height: 20px; background: ${theme.backgroundColor}; border-radius: 4px 4px 0 0;"></div>
            <div style="height: 20px; background: ${theme.iconBackgroundColor};"></div>
            <div style="height: 20px; background: ${theme.accentColor}; border-radius: 0 0 4px 4px;"></div>
          </div>
          <div style="text-align: center; font-size: 12px; color: #d4d4d4;">${theme.name}</div>
        `;
        themeGrid.appendChild(themeCard);
      });
    }
    
    // Show/hide custom colors section
    const customColorsSection = settingsPanel.querySelector('#wm-custom-colors-section');
    if (customColorsSection) {
      customColorsSection.style.display = (s.themeId === 'custom' || !s.themeId) ? 'block' : 'none';
    }
  }
  
  // Colors (for custom theme)
  const bgColor = settingsPanel.querySelector('#wm-bg-color');
  if (bgColor) bgColor.value = s.backgroundColor;
  const iconBgColor = settingsPanel.querySelector('#wm-icon-bg-color');
  if (iconBgColor) iconBgColor.value = s.iconBackgroundColor;
  const iconTextColor = settingsPanel.querySelector('#wm-icon-text-color');
  if (iconTextColor) iconTextColor.value = s.iconTextColor;
  const accentColor = settingsPanel.querySelector('#wm-accent-color');
  if (accentColor) accentColor.value = s.accentColor || '#007acc';
  
  // Alignment
  const alignmentInput = settingsPanel.querySelector(`input[name="wm-alignment"][value="${s.alignment}"]`);
  if (alignmentInput) alignmentInput.checked = true;

  // New tab URL (stored globally, load async)
  chrome.storage.local.get('newTabUrl', (data) => {
    const input = settingsPanel.querySelector('#wm-new-tab-url');
    if (input) input.value = (data && data.newTabUrl) ? data.newTabUrl : 'https://www.google.com/';
  });

  attachSettingsListeners();
}

function attachSettingsListeners() {
  const settingsPanel = document.getElementById('wm-settings-panel');
  if (!settingsPanel) return;

  // Mode
  const modeInputs = settingsPanel.querySelectorAll('input[name="wm-mode"]');
  modeInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      currentSettings.mode = e.target.value;
      if (e.target.value === 'hovering') currentSettings.collapsible = true;
      saveSettings();
    });
  });

  // Position
  const positionInputs = settingsPanel.querySelectorAll('input[name="wm-position"]');
  positionInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      currentSettings.position = e.target.value;
      saveSettings();
    });
  });

  // Width slider
  const widthSlider = settingsPanel.querySelector('#wm-width-slider');
  const widthValue = settingsPanel.querySelector('#wm-width-value');
  if (widthSlider && widthValue) {
    widthSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      widthValue.textContent = value + 'px';
      currentSettings.width = value;
      saveSettings();
    });
  }

  // Margins sliders
  const marginSide = settingsPanel.querySelector('#wm-margin-side');
  const marginSideValue = settingsPanel.querySelector('#wm-margin-side-value');
  if (marginSide) {
    marginSide.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentSettings.marginFromSide = value;
      if (marginSideValue) marginSideValue.textContent = value + 'px';
      saveSettings();
    });
  }
  const marginTop = settingsPanel.querySelector('#wm-margin-top');
  const marginTopValue = settingsPanel.querySelector('#wm-margin-top-value');
  if (marginTop) {
    marginTop.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentSettings.marginTop = value;
      if (marginTopValue) marginTopValue.textContent = value + 'px';
      saveSettings();
    });
  }
  const marginBottom = settingsPanel.querySelector('#wm-margin-bottom');
  const marginBottomValue = settingsPanel.querySelector('#wm-margin-bottom-value');
  if (marginBottom) {
    marginBottom.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentSettings.marginBottom = value;
      if (marginBottomValue) marginBottomValue.textContent = value + 'px';
      saveSettings();
    });
  }

  // Border radius sliders
  const borderRadius = settingsPanel.querySelector('#wm-border-radius');
  const borderRadiusValue = settingsPanel.querySelector('#wm-border-radius-value');
  if (borderRadius) {
    borderRadius.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentSettings.borderRadius = value;
      if (borderRadiusValue) borderRadiusValue.textContent = value + 'px';
      saveSettings();
    });
  }
  const iconBorderRadius = settingsPanel.querySelector('#wm-icon-border-radius');
  const iconBorderRadiusValue = settingsPanel.querySelector('#wm-icon-border-radius-value');
  if (iconBorderRadius) {
    iconBorderRadius.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      currentSettings.iconBorderRadius = value;
      if (iconBorderRadiusValue) iconBorderRadiusValue.textContent = value + 'px';
      saveSettings();
    });
  }

  // Theme cards
  const themeCards = settingsPanel.querySelectorAll('.wm-theme-card');
  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      const themeId = card.dataset.themeId;
      // Remove active class from all cards
      themeCards.forEach(c => c.classList.remove('active'));
      // Add active class to clicked card
      card.classList.add('active');
      applyTheme(themeId);
    });
  });
  
  // Colors (only active when custom theme is selected)
  const updateCustomThemePreview = () => {
    const customCard = settingsPanel.querySelector('.wm-theme-card[data-theme-id="custom"]');
    if (customCard) {
      const preview = customCard.querySelector('.wm-theme-preview');
      if (preview) {
        preview.innerHTML = `
          <div style="height: 20px; background: ${currentSettings.backgroundColor}; border-radius: 4px 4px 0 0;"></div>
          <div style="height: 20px; background: ${currentSettings.iconBackgroundColor};"></div>
          <div style="height: 20px; background: ${currentSettings.accentColor}; border-radius: 0 0 4px 4px;"></div>
        `;
      }
    }
  };
  
  const bgColor = settingsPanel.querySelector('#wm-bg-color');
  if (bgColor) {
    bgColor.addEventListener('change', (e) => {
      if (currentSettings.themeId === 'custom' || !currentSettings.themeId) {
        currentSettings.backgroundColor = e.target.value;
        updateCustomThemePreview();
        saveSettings();
      }
    });
  }
  const iconBgColor = settingsPanel.querySelector('#wm-icon-bg-color');
  if (iconBgColor) {
    iconBgColor.addEventListener('change', (e) => {
      if (currentSettings.themeId === 'custom' || !currentSettings.themeId) {
        currentSettings.iconBackgroundColor = e.target.value;
        updateCustomThemePreview();
        saveSettings();
      }
    });
  }
  const iconTextColor = settingsPanel.querySelector('#wm-icon-text-color');
  if (iconTextColor) {
    iconTextColor.addEventListener('change', (e) => {
      if (currentSettings.themeId === 'custom' || !currentSettings.themeId) {
        currentSettings.iconTextColor = e.target.value;
        saveSettings();
      }
    });
  }
  const accentColor = settingsPanel.querySelector('#wm-accent-color');
  if (accentColor) {
    accentColor.addEventListener('change', (e) => {
      if (currentSettings.themeId === 'custom' || !currentSettings.themeId) {
        currentSettings.accentColor = e.target.value;
        updateCustomThemePreview();
        saveSettings();
        // Update CSS variables for accent color
        updateAccentColorStyles(e.target.value);
      }
    });
  }

  // Alignment
  const alignmentInputs = settingsPanel.querySelectorAll('input[name="wm-alignment"]');
  alignmentInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      currentSettings.alignment = e.target.value;
      saveSettings();
    });
  });

  // New tab URL (saved globally for newtab.html)
  const newTabUrlInput = settingsPanel.querySelector('#wm-new-tab-url');
  if (newTabUrlInput) {
    newTabUrlInput.addEventListener('change', (e) => {
      const value = (e.target.value || '').trim();
      chrome.storage.local.set({ newTabUrl: value || 'https://www.google.com/' });
    });
  }

  const closeBtn = settingsPanel.querySelector('.wm-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closePanel('wm-settings-panel');
    });
  }
}

// Apply theme by ID
function applyTheme(themeId) {
  if (themeId === 'custom') {
    currentSettings.themeId = 'custom';
    const customColorsSection = document.querySelector('#wm-custom-colors-section');
    if (customColorsSection) customColorsSection.style.display = 'block';
    
    // Update active state in theme grid
    const themeGrid = document.querySelector('#wm-theme-grid');
    if (themeGrid) {
      const themeCards = themeGrid.querySelectorAll('.wm-theme-card');
      themeCards.forEach(card => {
        if (card.dataset.themeId === 'custom') {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    }
    
    saveSettings();
    return;
  }
  
  // Find theme in presets or custom themes
  let theme = PRESET_THEMES.find(t => t.id === themeId);
  if (!theme && currentSettings.customThemes) {
    theme = currentSettings.customThemes.find(t => t.id === themeId);
  }
  
  if (theme) {
    currentSettings.themeId = themeId;
    currentSettings.backgroundColor = theme.backgroundColor;
    currentSettings.iconBackgroundColor = theme.iconBackgroundColor;
    currentSettings.iconTextColor = theme.iconTextColor;
    currentSettings.borderColor = theme.borderColor;
    currentSettings.accentColor = theme.accentColor;
    
    // Hide custom colors section
    const customColorsSection = document.querySelector('#wm-custom-colors-section');
    if (customColorsSection) customColorsSection.style.display = 'none';
    
    // Update color inputs in case user switches back to custom
    const bgColor = document.querySelector('#wm-bg-color');
    if (bgColor) bgColor.value = theme.backgroundColor;
    const iconBgColor = document.querySelector('#wm-icon-bg-color');
    if (iconBgColor) iconBgColor.value = theme.iconBackgroundColor;
    const iconTextColor = document.querySelector('#wm-icon-text-color');
    if (iconTextColor) iconTextColor.value = theme.iconTextColor;
    const accentColor = document.querySelector('#wm-accent-color');
    if (accentColor) accentColor.value = theme.accentColor;
    
    // Update active state in theme grid
    const themeGrid = document.querySelector('#wm-theme-grid');
    if (themeGrid) {
      const themeCards = themeGrid.querySelectorAll('.wm-theme-card');
      themeCards.forEach(card => {
        if (card.dataset.themeId === themeId) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    }
    
    saveSettings();
  }
}

function saveSettings() {
  // Update sidebar styles immediately
  if (sidebarElement) {
    applySidebarStyles(sidebarElement, currentSettings);
  }
  
  // Update panel positions and styles
  applyPanelStyles(currentSettings);
  
  // Update accent color styles
  updateAccentColorStyles(currentSettings.accentColor || '#007acc');
  
  // Save to storage
  chrome.runtime.sendMessage({ type: 'getCurrentWorkspace' }, (response) => {
    if (chrome.runtime.lastError) return;
    
    const workspaceId = response?.workspaceId || 'default';
    
    chrome.storage.local.get('workspaceData', (data) => {
      if (chrome.runtime.lastError) return;
      
      let workspaceData = data.workspaceData || { workspaces: [], currentWorkspaceId: workspaceId };
      const workspaceIndex = workspaceData.workspaces.findIndex(w => w.id === workspaceId);
      
      if (workspaceIndex !== -1) {
        workspaceData.workspaces[workspaceIndex].settings = { ...currentSettings };
        workspaceData.workspaces[workspaceIndex].updatedAt = Date.now();
        chrome.storage.local.set({ workspaceData });
      }
    });
  });
}


// Bookmark and workspace management
function deleteBookmark(id) {
  currentBookmarks = currentBookmarks.filter((bm) => bm.id !== id);
  compactGridPositions(currentBookmarks);
  saveData();
}

function deleteWorkspace(id) {
  if (currentWorkspaces.length <= 1) {
    alert('Cannot delete the last workspace');
    return;
  }
  chrome.runtime.sendMessage({ type: 'deleteWorkspace', workspaceId: id }, (response) => {
    if (chrome.runtime.lastError) {
      alert('Failed to delete workspace');
      return;
    }
    if (response && response.success) {
      reloadSidebar();
    } else if (response && response.error) {
      alert(response.error);
    } else {
      alert('Failed to delete workspace');
    }
  });
}

function saveData(skipReload = false) {
  try {
    chrome.runtime.sendMessage({ type: 'getCurrentWorkspace' }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      
      const workspaceId = response?.workspaceId || 'default';
      
      chrome.storage.local.get('workspaceData', (data) => {
        if (chrome.runtime.lastError) {
          return;
        }
        
        let workspaceData = data.workspaceData || { workspaces: [], currentWorkspaceId: workspaceId };
        
        // Remove workspaces that are no longer in currentWorkspaces (deleted)
        workspaceData.workspaces = workspaceData.workspaces.filter(w => 
          currentWorkspaces.some(cws => cws.id === w.id)
        );
        
        // Update workspace icons and grid positions, and add new workspaces
        currentWorkspaces.forEach(ws => {
          const existingIndex = workspaceData.workspaces.findIndex(w => w.id === ws.id);
          if (existingIndex !== -1) {
            // Update existing workspace
            workspaceData.workspaces[existingIndex].name = ws.name;
            workspaceData.workspaces[existingIndex].gridRow = ws.gridRow;
            workspaceData.workspaces[existingIndex].gridCol = ws.gridCol;
            if (ws.icon !== undefined) {
              workspaceData.workspaces[existingIndex].icon = ws.icon;
            }
          } else {
            // Add new workspace
            workspaceData.workspaces.push({
              id: ws.id,
              name: ws.name,
              icon: ws.icon,
              gridRow: ws.gridRow,
              gridCol: ws.gridCol,
              bookmarks: [],
              openTabs: [],
              closedTabs: [],
              settings: { ...DEFAULT_SETTINGS },
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        });
        
        workspaceData.currentWorkspaceId = workspaceId;
        
        const workspaceIndex = workspaceData.workspaces.findIndex(w => w.id === workspaceId);
        const settingsToSave = { ...currentSettings };
        if (settingsToSave.mode === 'hovering') settingsToSave.collapsible = true;
        if (workspaceIndex !== -1) {
          // Only update bookmarks/settings; background owns closedTabs/activeTabUrl (tab state)
          workspaceData.workspaces[workspaceIndex].bookmarks = currentBookmarks;
          workspaceData.workspaces[workspaceIndex].settings = settingsToSave;
          // Preserve icon if it exists
          if (currentWorkspaces.find(ws => ws.id === workspaceId)?.icon) {
            workspaceData.workspaces[workspaceIndex].icon = currentWorkspaces.find(ws => ws.id === workspaceId).icon;
          }
          workspaceData.workspaces[workspaceIndex].updatedAt = Date.now();
        } else {
          workspaceData.workspaces.push({
            id: workspaceId,
            name: 'Default',
            active: true,
            bookmarks: currentBookmarks,
            openTabs: [],
            closedTabs: [],
            settings: settingsToSave,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
        
        // Also save workspace icons
        currentWorkspaces.forEach(ws => {
          const wsIndex = workspaceData.workspaces.findIndex(w => w.id === ws.id);
          if (wsIndex !== -1 && ws.icon !== undefined) {
            workspaceData.workspaces[wsIndex].icon = ws.icon;
          }
        });
        
        chrome.storage.local.set({ workspaceData }, () => {
          if (chrome.runtime.lastError) {
            return;
          }
          if (!skipReload && sidebarElement) {
            reloadSidebar();
          }
        });
      });
    });
  } catch (err) {
    // Ignore errors
  }
}

function reloadSidebar() {
  if (sidebarElement) {
    sidebarElement.remove();
    sidebarElement = null;
  }
  createSidebar();
}

function switchWorkspace(workspaceId) {
  chrome.runtime.sendMessage({ type: 'switchWorkspace', workspaceId }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Switch workspace error:', chrome.runtime.lastError.message);
      return;
    }
    if (response && response.success === false && response.error) {
      console.error('Switch workspace failed:', response.error);
      return;
    }
    setTimeout(() => {
      reloadSidebar();
    }, 200);
  });
}

// Pointer-based drag and drop (reliable for links and in content scripts)
const DRAG_THRESHOLD_PX = 5;

function setupDragAndDrop(sidebar, containerSelector, itemSelector, type) {
  const container = sidebar.querySelector(containerSelector);
  if (!container) return;

  let draggedElement = null;
  let startX = 0;
  let startY = 0;
  let dragStarted = false;
  let lastOverElement = null;

  function clearDragOverState() {
    container.querySelectorAll(itemSelector).forEach((el) => el.classList.remove('wm-drag-over'));
    lastOverElement = null;
  }

  function applyReorder(dragged, target) {
    if (!dragged || !target || dragged === target) return;
    const allItems = Array.from(container.querySelectorAll(itemSelector));
    const draggedIndex = allItems.indexOf(dragged);
    const targetIndex = allItems.indexOf(target);
    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

    if (draggedIndex < targetIndex) {
      container.insertBefore(dragged, target.nextSibling);
    } else {
      container.insertBefore(dragged, target);
    }

    const reorderedItems = Array.from(container.querySelectorAll(itemSelector));
    const newOrderIds = reorderedItems.map((domItem) => domItem.getAttribute('data-workspace-id') || domItem.getAttribute('data-bookmark-id')).filter(Boolean);

    reorderedItems.forEach((domItem, index) => {
      const id = domItem.getAttribute('data-workspace-id') || domItem.getAttribute('data-bookmark-id');
      if (!id) return;
      const gridPos = indexToGridPosition(index);
      domItem.style.gridRow = (gridPos.row + 1) + '';
      domItem.style.gridColumn = (gridPos.col + 1) + '';
      if (type === 'workspaces') {
        const ws = currentWorkspaces.find((ws) => ws.id === id);
        if (ws) { ws.gridRow = gridPos.row; ws.gridCol = gridPos.col; }
      } else if (type === 'bookmarks') {
        const bm = currentBookmarks.find((bm) => bm.id === id);
        if (bm) { bm.gridRow = gridPos.row; bm.gridCol = gridPos.col; }
      }
    });

    if (type === 'workspaces' && newOrderIds.length > 0) {
      const ordered = newOrderIds.map((id) => currentWorkspaces.find((ws) => ws.id === id)).filter(Boolean);
      if (ordered.length === currentWorkspaces.length) {
        currentWorkspaces.length = 0;
        currentWorkspaces.push(...ordered);
      }
    } else if (type === 'bookmarks' && newOrderIds.length > 0) {
      const ordered = newOrderIds.map((id) => currentBookmarks.find((bm) => bm.id === id)).filter(Boolean);
      if (ordered.length === currentBookmarks.length) {
        currentBookmarks.length = 0;
        currentBookmarks.push(...ordered);
      }
    }
    saveData(true);
    cancelPendingCollapse();
  }

  function onMouseMove(e) {
    if (!draggedElement) return;
    if (!dragStarted) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      dragStarted = true;
      isDragging = true;
      draggedElement.classList.add('dragging');
      clearDragOverState();
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const dropTarget = under ? under.closest(itemSelector) : null;
    if (dropTarget && container.contains(dropTarget) && dropTarget !== draggedElement) {
      if (lastOverElement !== dropTarget) {
        clearDragOverState();
        lastOverElement = dropTarget;
        dropTarget.classList.add('wm-drag-over');
      }
    } else {
      clearDragOverState();
    }
  }

  function onMouseUp(e) {
    if (!draggedElement) return;
    const wasDragging = dragStarted;
    if (wasDragging) {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const dropTarget = under ? under.closest(itemSelector) : null;
      if (dropTarget && container.contains(dropTarget) && dropTarget !== draggedElement) {
        applyReorder(draggedElement, dropTarget);
      }
      draggedElement.classList.remove('dragging');
      isDragging = false;
      dragJustEnded = true;
      setTimeout(() => { dragJustEnded = false; }, 0);
      clearDragOverState();
      cancelPendingCollapse();
    }
    draggedElement = null;
    dragStarted = false;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
  }

  container.querySelectorAll(itemSelector).forEach((item) => {
    item.classList.add('wm-draggable');
    item.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      draggedElement = item;
      dragStarted = false;
      startX = e.clientX;
      startY = e.clientY;
      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('mouseup', onMouseUp, true);
      e.preventDefault();
    });
  });
}

// Context menus
// Icon presets - using black & white SVG icons
const ICON_PRESETS = [
  // Folder, Briefcase, Target, Rocket, Star, Fire, Lightbulb, Palette, Chart, Wrench
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6L5 4H10L12 6H17V16H3V6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6H17V16H3V6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 6V4C8 3.44772 8.44772 3 9 3H11C11.5523 3 12 3.44772 12 4V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="1" fill="currentColor"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 15L10 10L15 15M10 5V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 5L7 8L10 10L13 8L10 5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2L12.5 7.5L18.5 8.5L14 12.5L15 18.5L10 15L5 18.5L6 12.5L1.5 8.5L7.5 7.5L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3C10 3 7 5 7 8C7 10 8 11 10 11C12 11 13 10 13 8C13 5 10 3 10 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12L7 17H13L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M10 6V10L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="4" height="4" stroke="currentColor" stroke-width="1.5"/><rect x="12" y="4" width="4" height="4" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="12" width="4" height="4" stroke="currentColor" stroke-width="1.5"/><rect x="12" y="12" width="4" height="4" stroke="currentColor" stroke-width="1.5"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 17H17M5 17V10L8 7H12L15 10V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 7V4H12V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 4L6 6L8 8M12 4L14 6L12 8M8 16L6 14L8 12M12 16L14 14L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="10" r="2" stroke="currentColor" stroke-width="1.5"/></svg>`,
  // Game, Phone, Laptop, Globe, Document, Book, Music, Film, Home, Lightning
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="6" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8 6V5C8 4.44772 8.44772 4 9 4H11C11.5523 4 12 4.44772 12 5V6" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="3" width="8" height="14" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 5H12M8 15H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="6" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M6 6V5C6 4.44772 6.44772 4 7 4H13C13.5523 4 14 4.44772 14 5V6" stroke="currentColor" stroke-width="1.5"/><path d="M7 12H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M10 3C7 5 5 7 5 10C5 13 7 15 10 15C13 15 15 13 15 10C15 7 13 5 10 3Z" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2" stroke="currentColor" stroke-width="1.5"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 4H15V16H5V4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 7H13M7 10H13M7 13H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 4H15V16H5V4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 7H13M7 10H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10L9 12L13 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="5" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M7 5V4C7 3.44772 7.44772 3 8 3H12C12.5523 3 13 3.44772 13 4V5" stroke="currentColor" stroke-width="1.5"/><path d="M7 9H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4 8H8V17H12V8H16L10 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L7 10H13L10 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10L10 17L13 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // Star, Tent, Trophy, Theater, Crystal, Diamond, Gift, Rainbow, Sun, Moon
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2L11.5 7.5L17 8.5L13 12.5L14 18L10 15L6 18L7 12.5L3 8.5L8.5 7.5L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 17L10 4L15 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 12H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8L7 6H13L14 8V14H6V8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 14V16H12V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="11" r="1" fill="currentColor"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="6" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M7 6V5C7 4.44772 7.44772 4 8 4H12C12.5523 4 13 4.44772 13 5V6" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="11" r="1.5" fill="currentColor"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 4L12 8L16 9L13 12L14 16L10 14L6 16L7 12L4 9L8 8L10 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 4L11 8L15 9L12 12L13 16L10 14L7 16L8 12L5 9L9 8L10 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="8" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M8 8V6C8 5.44772 8.44772 5 9 5H11C11.5523 5 12 5.44772 12 6V8" stroke="currentColor" stroke-width="1.5"/><path d="M10 11H10.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 10C3 6 6 3 10 3C14 3 17 6 17 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3 10C3 14 6 17 10 17C14 17 17 14 17 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M10 4V6M10 14V16M16 10H14M6 10H4M15 5L13.5 6.5M6.5 13.5L5 15M15 15L13.5 13.5M6.5 6.5L5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 4C7 4 5 6 5 9C5 12 7 14 10 14C13 14 15 12 15 9C15 6 13 4 10 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
];

function openIconPicker(currentIcon, onSelect) {
  // Close all other modals/panels first
  closeAllModals();
  // Cancel any pending collapse
  cancelPendingCollapse();
  
  let modal = document.getElementById('wm-icon-picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wm-icon-picker-modal';
    modal.className = 'wm-panel-overlay';
    modal.innerHTML = `
      <div class="wm-panel" style="max-width: 500px;">
        <div class="wm-panel-header">
          <h2>Choose Icon</h2>
          <button class="wm-panel-close">&times;</button>
        </div>
        <div class="wm-panel-content">
          <div class="wm-form-group">
            <label class="wm-form-label">Icon URL or Emoji</label>
            <input type="text" id="wm-icon-url-input" class="wm-form-input" placeholder="Enter URL or emoji">
          </div>
          <div class="wm-form-group">
            <label class="wm-form-label">Preset Icons</label>
            <div class="wm-icon-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px;">
              ${ICON_PRESETS.map(icon => `
                <button class="wm-icon-preset" style="width: 40px; height: 40px; border: 1px solid #3e3e42; background: #2d2d2d; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #d4d4d4; padding: 0;">${icon}</button>
              `).join('')}
            </div>
          </div>
          <div class="wm-form-group">
            <label class="wm-form-label">Or use first letter</label>
            <button id="wm-use-letter-btn" class="wm-form-input" style="cursor: pointer; background: #2d2d2d; border: 1px solid #3e3e42; color: #d4d4d4; padding: 8px;">Use First Letter</button>
          </div>
        </div>
        <div class="wm-modal-footer" style="padding: 20px; border-top: 1px solid #3e3e42; display: flex; gap: 10px; justify-content: flex-end;">
          <button class="wm-form-cancel" style="padding: 8px 16px; background: #3e3e42; border: none; border-radius: 4px; color: #d4d4d4; cursor: pointer;">Cancel</button>
          <button class="wm-form-submit" style="padding: 8px 16px; background: #007acc; border: none; border-radius: 4px; color: #ffffff; cursor: pointer;">Select</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('.wm-panel-close').addEventListener('click', () => closeIconPicker());
    modal.querySelector('.wm-form-cancel').addEventListener('click', () => closeIconPicker());
    
    // Preset icon clicks
    modal.querySelectorAll('.wm-icon-preset').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const urlInput = modal.querySelector('#wm-icon-url-input');
        if (urlInput) {
          // Store SVG icon as data URL or keep as SVG string
          urlInput.value = ICON_PRESETS[index];
        }
      });
    });
    
    // Use first letter button
    const useLetterBtn = modal.querySelector('#wm-use-letter-btn');
    if (useLetterBtn) {
      useLetterBtn.addEventListener('click', () => {
        const urlInput = modal.querySelector('#wm-icon-url-input');
        if (urlInput) urlInput.value = '';
      });
    }
    
    // Submit button
    modal.querySelector('.wm-form-submit').addEventListener('click', () => {
      const urlInput = modal.querySelector('#wm-icon-url-input');
      const iconValue = urlInput ? urlInput.value.trim() : '';
      closeIconPicker();
      if (onSelect) onSelect(iconValue || null);
    });
  }
  
  const urlInput = modal.querySelector('#wm-icon-url-input');
  if (urlInput) urlInput.value = currentIcon || '';
  
  // Apply panel positioning and styling
  if (window.wmPanelPositionUpdater) {
    window.wmPanelPositionUpdater();
  }
  
  modal.classList.add('active');
  if (urlInput) urlInput.focus();
}

function closeIconPicker() {
  closePanel('wm-icon-picker-modal');
}

function handleWorkspaceContextMenu(e) {
  e.preventDefault();
  const btn = e.target.closest('[data-workspace-id]');
  const id = btn.dataset.workspaceId;
  const ws = currentWorkspaces.find((w) => w.id === id);
  
  showContextMenu(e.pageX, e.pageY, [
    { 
      label: 'Edit', 
      action: () => {
        closeAllModals();
        openEditWorkspaceModal(ws);
      }
    },
    { 
      label: 'Delete', 
      action: () => {
        closeAllModals();
        openConfirmModal('Delete Workspace', `Delete workspace "${ws.name}"?`, () => {
          deleteWorkspace(id);
        });
      }
    }
  ]);
}

// Integrated Edit Workspace Modal (name + icon in one modal)
function openEditWorkspaceModal(ws) {
  let modal = document.getElementById('wm-form-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wm-form-modal';
    modal.className = 'wm-panel-overlay';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="wm-panel" style="max-width: 500px;">
      <div class="wm-panel-header">
        <h2>Edit Workspace</h2>
        <button class="wm-panel-close">&times;</button>
      </div>
      <div class="wm-panel-content">
        <div class="wm-form-group">
          <label class="wm-form-label">Workspace Name</label>
          <input type="text" id="wm-edit-workspace-name" class="wm-form-input" placeholder="Enter workspace name" value="${ws.name || ''}">
        </div>
        <div class="wm-form-group">
          <label class="wm-form-label">Icon</label>
          <input type="text" id="wm-edit-workspace-icon" class="wm-form-input" placeholder="Enter URL or emoji" value="${ws.icon || ''}" style="margin-bottom: 8px;">
          <div class="wm-icon-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px;">
            ${ICON_PRESETS.map(icon => `
              <button class="wm-icon-preset wm-edit-icon-preset" style="width: 40px; height: 40px; border: 1px solid #3e3e42; background: #2d2d2d; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #d4d4d4; padding: 0;">${icon}</button>
            `).join('')}
          </div>
          <button id="wm-edit-clear-icon" style="margin-top: 8px; padding: 6px 12px; background: transparent; border: 1px solid #3e3e42; border-radius: 4px; color: #888; cursor: pointer; font-size: 12px;">Use first letter</button>
        </div>
      </div>
      <div class="wm-modal-footer" style="padding: 20px; border-top: 1px solid #3e3e42; display: flex; gap: 10px; justify-content: flex-end;">
        <button class="wm-form-cancel" style="padding: 8px 16px; background: #3e3e42; border: none; border-radius: 4px; color: #d4d4d4; cursor: pointer;">Cancel</button>
        <button class="wm-form-submit" style="padding: 8px 16px; background: #007acc; border: none; border-radius: 4px; color: #ffffff; cursor: pointer;">Save</button>
      </div>
    </div>
  `;
  
  // Icon preset clicks
  modal.querySelectorAll('.wm-edit-icon-preset').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      const iconInput = modal.querySelector('#wm-edit-workspace-icon');
      if (iconInput) iconInput.value = ICON_PRESETS[index];
    });
  });
  
  // Clear icon button
  const clearIconBtn = modal.querySelector('#wm-edit-clear-icon');
  if (clearIconBtn) {
    clearIconBtn.addEventListener('click', () => {
      const iconInput = modal.querySelector('#wm-edit-workspace-icon');
      if (iconInput) iconInput.value = '';
    });
  }
  
  // Close handlers
  modal.querySelector('.wm-panel-close').addEventListener('click', () => closeFormModal());
  modal.querySelector('.wm-form-cancel').addEventListener('click', () => closeFormModal());
  
  // Submit handler
  modal.querySelector('.wm-form-submit').addEventListener('click', () => {
    const nameInput = modal.querySelector('#wm-edit-workspace-name');
    const iconInput = modal.querySelector('#wm-edit-workspace-icon');
    
    if (nameInput && nameInput.value.trim()) {
      ws.name = nameInput.value.trim();
      ws.icon = iconInput && iconInput.value.trim() ? iconInput.value.trim() : undefined;
      closeFormModal();
      saveData();
    }
  });
  
  // Apply panel positioning
  if (window.wmPanelPositionUpdater) {
    window.wmPanelPositionUpdater();
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  } else {
    modal.classList.add('active');
  }
  
  // Focus name input
  const nameInput = modal.querySelector('#wm-edit-workspace-name');
  if (nameInput) nameInput.focus();
}

function handleBookmarkContextMenu(e) {
  e.preventDefault();
  const btn = e.target.closest('.wm-bookmark');
  const id = btn.dataset.bookmarkId;
  const bm = currentBookmarks.find((b) => b.id === id);
  
  showContextMenu(e.pageX, e.pageY, [
    { 
      label: 'Edit', 
      action: () => {
        closeAllModals();
        openEditBookmarkModal(bm);
      }
    },
    { 
      label: 'Delete', 
      action: () => {
        closeAllModals();
        openConfirmModal('Delete Bookmark', `Delete bookmark "${bm.title}"?`, () => {
          deleteBookmark(id);
        });
      }
    }
  ]);
}

// Integrated Edit Bookmark Modal (title + URL + icon in one modal)
function openEditBookmarkModal(bm) {
  let modal = document.getElementById('wm-form-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wm-form-modal';
    modal.className = 'wm-panel-overlay';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="wm-panel" style="max-width: 500px;">
      <div class="wm-panel-header">
        <h2>Edit Bookmark</h2>
        <button class="wm-panel-close">&times;</button>
      </div>
      <div class="wm-panel-content">
        <div class="wm-form-group">
          <label class="wm-form-label">Title</label>
          <input type="text" id="wm-edit-bookmark-title" class="wm-form-input" placeholder="Bookmark title" value="${bm.title || ''}">
        </div>
        <div class="wm-form-group">
          <label class="wm-form-label">URL</label>
          <input type="text" id="wm-edit-bookmark-url" class="wm-form-input" placeholder="https://example.com" value="${bm.url || ''}">
        </div>
        <div class="wm-form-group">
          <button id="wm-edit-toggle-icon-picker" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: transparent; border: 1px solid #3e3e42; border-radius: 4px; color: #888; cursor: pointer; font-size: 13px; width: 100%; text-align: left;">
            <span id="wm-edit-icon-toggle-arrow" style="transition: transform 0.2s;">${bm.icon ? '▼' : '▶'}</span>
            <span>Custom Icon ${bm.icon ? '(set)' : '(using favicon)'}</span>
          </button>
          <div id="wm-edit-icon-picker-section" style="display: ${bm.icon ? 'block' : 'none'}; margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px;">
            <p style="font-size: 11px; color: #888; margin-bottom: 8px;">Leave empty to auto-fetch favicon from website</p>
            <input type="text" id="wm-edit-bookmark-icon" class="wm-form-input" placeholder="Enter URL, emoji, or select preset" value="${bm.icon || ''}" style="margin-bottom: 8px;">
            <div class="wm-icon-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px;">
              ${ICON_PRESETS.map(icon => `
                <button class="wm-icon-preset wm-edit-bookmark-icon-preset" style="width: 40px; height: 40px; border: 1px solid #3e3e42; background: #2d2d2d; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #d4d4d4; padding: 0;">${icon}</button>
              `).join('')}
            </div>
            <button id="wm-edit-bookmark-clear-icon" style="margin-top: 8px; padding: 6px 12px; background: transparent; border: 1px solid #3e3e42; border-radius: 4px; color: #888; cursor: pointer; font-size: 12px;">Clear (use favicon)</button>
          </div>
        </div>
      </div>
      <div class="wm-modal-footer" style="padding: 20px; border-top: 1px solid #3e3e42; display: flex; gap: 10px; justify-content: flex-end;">
        <button class="wm-form-cancel" style="padding: 8px 16px; background: #3e3e42; border: none; border-radius: 4px; color: #d4d4d4; cursor: pointer;">Cancel</button>
        <button class="wm-form-submit" style="padding: 8px 16px; background: #007acc; border: none; border-radius: 4px; color: #ffffff; cursor: pointer;">Save</button>
      </div>
    </div>
  `;
  
  // Toggle icon picker visibility
  const toggleIconBtn = modal.querySelector('#wm-edit-toggle-icon-picker');
  const iconPickerSection = modal.querySelector('#wm-edit-icon-picker-section');
  const toggleArrow = modal.querySelector('#wm-edit-icon-toggle-arrow');
  if (toggleIconBtn && iconPickerSection && toggleArrow) {
    toggleIconBtn.addEventListener('click', () => {
      const isHidden = iconPickerSection.style.display === 'none';
      iconPickerSection.style.display = isHidden ? 'block' : 'none';
      toggleArrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    });
  }
  
  // Icon preset clicks
  modal.querySelectorAll('.wm-edit-bookmark-icon-preset').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      const iconInput = modal.querySelector('#wm-edit-bookmark-icon');
      if (iconInput) iconInput.value = ICON_PRESETS[index];
    });
  });
  
  // Clear icon button
  const clearIconBtn = modal.querySelector('#wm-edit-bookmark-clear-icon');
  if (clearIconBtn) {
    clearIconBtn.addEventListener('click', () => {
      const iconInput = modal.querySelector('#wm-edit-bookmark-icon');
      if (iconInput) iconInput.value = '';
    });
  }
  
  // Close handlers
  modal.querySelector('.wm-panel-close').addEventListener('click', () => closeFormModal());
  modal.querySelector('.wm-form-cancel').addEventListener('click', () => closeFormModal());
  
  // Submit handler
  modal.querySelector('.wm-form-submit').addEventListener('click', () => {
    const titleInput = modal.querySelector('#wm-edit-bookmark-title');
    const urlInput = modal.querySelector('#wm-edit-bookmark-url');
    const iconInput = modal.querySelector('#wm-edit-bookmark-icon');
    
    if (titleInput && titleInput.value.trim() && urlInput && urlInput.value.trim()) {
      bm.title = titleInput.value.trim();
      bm.url = urlInput.value.trim();
      bm.icon = iconInput && iconInput.value.trim() ? iconInput.value.trim() : undefined;
      closeFormModal();
      saveData();
    }
  });
  
  // Apply panel positioning
  if (window.wmPanelPositionUpdater) {
    window.wmPanelPositionUpdater();
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  } else {
    modal.classList.add('active');
  }
  
  // Focus title input
  const titleInput = modal.querySelector('#wm-edit-bookmark-title');
  if (titleInput) titleInput.focus();
}

function showContextMenu(x, y, items) {
  const existingMenu = document.getElementById('wm-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const menu = document.createElement('div');
  menu.id = 'wm-context-menu';
  menu.className = 'wm-context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  
  menu.innerHTML = items.map(item => `
    <div class="wm-context-menu-item" data-action="${item.label}">${item.label}</div>
  `).join('');
  
  document.body.appendChild(menu);
  
  menu.querySelectorAll('.wm-context-menu-item').forEach((menuItem, index) => {
    menuItem.addEventListener('click', () => {
      items[index].action();
      menu.remove();
    });
  });
  
  document.addEventListener('click', function closeMenu(e) {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  }, { once: true });
}

// Sidebar creation and rendering
function createSidebar() {
  if (document.getElementById('workspace-manager-sidebar')) {
    return;
  }

  try {
    // Check if chrome.storage is available (might not be on some chrome:// pages)
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      // Use defaults and create sidebar anyway
      currentWorkspaces = DEFAULT_WORKSPACES.map((ws, i) => ({
        ...ws,
        gridRow: i,
        gridCol: 0
      }));
      currentBookmarks = DEFAULT_BOOKMARKS.map((bm, i) => ({
        ...bm,
        gridRow: i,
        gridCol: 0
      }));
      migrateToGridPositions(currentBookmarks);
      migrateToGridPositions(currentWorkspaces);
      currentSettings = { ...DEFAULT_SETTINGS };
      updateAccentColorStyles('#007acc');
      renderSidebarWithData('left', true, false);
      return;
    }
    
    chrome.storage.local.get('workspaceData', (data) => {
      try {
        if (chrome.runtime.lastError) {
          // Use defaults on error
          currentWorkspaces = DEFAULT_WORKSPACES.map((ws, i) => ({
            ...ws,
            gridRow: i,
            gridCol: 0
          }));
          currentBookmarks = DEFAULT_BOOKMARKS.map((bm, i) => ({
            ...bm,
            gridRow: i,
            gridCol: 0
          }));
          migrateToGridPositions(currentBookmarks);
          migrateToGridPositions(currentWorkspaces);
          currentSettings = { ...DEFAULT_SETTINGS };
          updateAccentColorStyles('#007acc');
          renderSidebarWithData('left', true, false);
          return;
        }
        
        const workspaceData = data.workspaceData;
        
        if (!workspaceData || !workspaceData.workspaces || workspaceData.workspaces.length === 0) {
          currentWorkspaces = DEFAULT_WORKSPACES.map((ws, i) => ({
            ...ws,
            gridRow: i,
            gridCol: 0
          }));
          currentBookmarks = DEFAULT_BOOKMARKS.map((bm, i) => ({
            ...bm,
            gridRow: i,
            gridCol: 0
          }));
          currentSettings = { ...DEFAULT_SETTINGS };
          updateAccentColorStyles('#007acc');
        } else {
          currentWorkspaces = workspaceData.workspaces.map((ws, i) => ({
            ...ws,
            icon: ws.icon, // Preserve icon
            gridRow: ws.gridRow !== undefined ? ws.gridRow : i,
            gridCol: ws.gridCol !== undefined ? ws.gridCol : 0
          }));
          
          const currentWorkspaceId = workspaceData.currentWorkspaceId || workspaceData.workspaces[0]?.id || 'default';
          let workspace = workspaceData.workspaces.find(w => w.id === currentWorkspaceId);
          
          if (!workspace) {
            workspace = workspaceData.workspaces[0];
            workspaceData.currentWorkspaceId = workspace.id;
            chrome.storage.local.set({ workspaceData });
          }
          
          if (workspace && workspace.bookmarks) {
            currentBookmarks = workspace.bookmarks;
          } else {
            currentBookmarks = DEFAULT_BOOKMARKS;
          }
          
          // Load workspace settings
          if (workspace && workspace.settings) {
            // Migrate existing workspaces to new defaults (only if they have old values)
            const oldDefaults = {
              marginFromSide: 10,
              marginTop: 10,
              marginBottom: 10,
              width: 56,
              borderRadius: 30,
              iconBorderRadius: 8
            };
            
            const needsMigration = 
              workspace.settings.marginFromSide === oldDefaults.marginFromSide ||
              workspace.settings.marginTop === oldDefaults.marginTop ||
              workspace.settings.marginBottom === oldDefaults.marginBottom ||
              workspace.settings.width === oldDefaults.width ||
              workspace.settings.borderRadius === oldDefaults.borderRadius ||
              workspace.settings.iconBorderRadius === oldDefaults.iconBorderRadius;
            
            if (needsMigration) {
              // Update to new defaults
              workspace.settings.marginFromSide = 0;
              workspace.settings.marginTop = 0;
              workspace.settings.marginBottom = 0;
              workspace.settings.width = 52;
              workspace.settings.borderRadius = 0;
              workspace.settings.iconBorderRadius = 25;
              workspace.settings.position = 'left';
              workspace.settings.alignment = 'top';
              
              // Save updated settings
              chrome.storage.local.get('workspaceData', (data) => {
                if (data.workspaceData) {
                  const wsIndex = data.workspaceData.workspaces.findIndex(w => w.id === workspace.id);
                  if (wsIndex !== -1) {
                    data.workspaceData.workspaces[wsIndex].settings = workspace.settings;
                    chrome.storage.local.set({ workspaceData: data.workspaceData });
                  }
                }
              });
            }
            
            currentSettings = mergeSettings(workspace.settings);
            // Ensure accent color is set
            if (!currentSettings.accentColor) {
              currentSettings.accentColor = '#007acc';
            }
          } else {
            currentSettings = { ...DEFAULT_SETTINGS };
          }
          
          // Initialize accent color styles
          updateAccentColorStyles(currentSettings.accentColor || '#007acc');
        }
        
        migrateToGridPositions(currentBookmarks);
        migrateToGridPositions(currentWorkspaces);
        
        currentBookmarks.sort((a, b) => {
          const indexA = gridPositionToIndex(a.gridRow || 0, a.gridCol || 0);
          const indexB = gridPositionToIndex(b.gridRow || 0, b.gridCol || 0);
          return indexA - indexB;
        });
        currentWorkspaces.sort((a, b) => {
          const indexA = gridPositionToIndex(a.gridRow || 0, a.gridCol || 0);
          const indexB = gridPositionToIndex(b.gridRow || 0, b.gridCol || 0);
          return indexA - indexB;
        });
        
        // Use workspace settings for position
        const position = currentSettings.position || 'left';
        sidebarCollapsed = false;
        
        // Initialize accent color styles
        updateAccentColorStyles(currentSettings.accentColor || '#007acc');
        
        renderSidebarWithData(position, sidebarCollapsed);
      } catch (err) {
        currentBookmarks = DEFAULT_BOOKMARKS;
        currentWorkspaces = DEFAULT_WORKSPACES;
        currentSettings = { ...DEFAULT_SETTINGS };
        updateAccentColorStyles('#007acc');
        renderSidebarWithData('left', false);
      }
    });
  } catch (err) {
    // Use defaults on error
    currentBookmarks = DEFAULT_BOOKMARKS;
    currentWorkspaces = DEFAULT_WORKSPACES;
    renderSidebarWithData('left', true, false);
  }
}

// Auto-collapse functionality for hovering mode
let autoCollapseTimeout = null;
let isTransitioning = false; // Track if sidebar is currently animating

// Function to cancel pending collapse (called when modals open)
function cancelPendingCollapse() {
  if (autoCollapseTimeout) {
    clearTimeout(autoCollapseTimeout);
    autoCollapseTimeout = null;
  }
}

// Helper to check if any modal/panel is open
function isAnyModalOpen() {
  const modals = [
    'wm-settings-panel',
    'wm-form-modal',
    'wm-confirm-modal',
    'wm-icon-picker-modal'
  ];
  
  return modals.some(id => {
    const element = document.getElementById(id);
    if (!element) return false;
    // Check if element is visible (not hidden, has active class, or display is not none)
    return !element.classList.contains('hidden') && 
           element.style.display !== 'none' &&
           (element.classList.contains('active') || 
            getComputedStyle(element).display !== 'none');
  });
}

function setupAutoCollapse(sidebar) {
  if (!sidebar) {
    return;
  }
  
  // Only setup once
  if (sidebar.dataset.autoCollapseSetup === 'true') {
    return;
  }
  sidebar.dataset.autoCollapseSetup = 'true';
  
  const AUTO_COLLAPSE_DELAY = 0; // 0ms delay before collapsing (testing smoothness)
  
  // Helper to get current settings
  const getCurrentSettings = () => {
    return currentSettings || DEFAULT_SETTINGS;
  };
  
  // Helper to update collapsed state
  const setCollapsedState = (collapsed) => {
    const settings = getCurrentSettings();
    
    if (settings.mode !== 'hovering') {
      return;
    }
    
    // Mark as transitioning to prevent interference
    isTransitioning = true;
    
    // Update local state
    currentSettings.collapsed = collapsed;
    
    const COLLAPSED_WIDTH = 8; // Width when collapsed
    
    // Use actual width animation instead of scaleX (avoids distortion)
    // Set transition for width and position
    sidebar.style.transition = 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.35s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1), left 0.35s cubic-bezier(0.4, 0, 0.2, 1), right 0.35s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1), margin-right 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    sidebar.style.transform = 'none'; // Clear any previous transforms
    
    // Force reflow
    void sidebar.offsetWidth;
    
    // Use requestAnimationFrame to ensure transition is active
    requestAnimationFrame(() => {
      if (collapsed) {
        // Animate to collapsed width
        sidebar.style.width = COLLAPSED_WIDTH + 'px';
        sidebar.style.minWidth = COLLAPSED_WIDTH + 'px';
        sidebar.style.maxWidth = COLLAPSED_WIDTH + 'px';
        
        if (settings.position === 'left') {
          sidebar.style.left = '0';
          sidebar.style.right = 'auto';
          sidebar.style.marginLeft = '0';
          sidebar.style.marginRight = '';
        } else {
          sidebar.style.right = '0';
          sidebar.style.left = 'auto';
          sidebar.style.marginRight = '0';
          sidebar.style.marginLeft = '';
        }
        
        sidebar.classList.add('wm-auto-collapsed');
      } else {
        sidebar.classList.remove('wm-auto-collapsed');
        
        // Animate to full width
        sidebar.style.width = settings.width + 'px';
        sidebar.style.minWidth = settings.width + 'px';
        sidebar.style.maxWidth = settings.width + 'px';
        
        if (settings.position === 'left') {
          sidebar.style.left = settings.marginFromSide + 'px';
          sidebar.style.right = 'auto';
          sidebar.style.marginLeft = '';
          sidebar.style.marginRight = '';
        } else {
          sidebar.style.right = settings.marginFromSide + 'px';
          sidebar.style.left = 'auto';
          sidebar.style.marginRight = '';
          sidebar.style.marginLeft = '';
        }
      }
      
      // Clear transitioning flag after animation completes
      setTimeout(() => {
        isTransitioning = false;
      }, 550); // Slightly longer than animation duration (500ms + 50ms buffer)
    });
    
    // Save to storage (same pattern as saveSettings)
    chrome.runtime.sendMessage({ type: 'getCurrentWorkspace' }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      
      const workspaceId = response?.workspaceId || 'default';
      
      chrome.storage.local.get('workspaceData', (data) => {
        if (chrome.runtime.lastError) {
          return;
        }
        
        let workspaceData = data.workspaceData || { workspaces: [], currentWorkspaceId: workspaceId };
        const workspaceIndex = workspaceData.workspaces.findIndex(w => w.id === workspaceId);
        
        if (workspaceIndex !== -1) {
          workspaceData.workspaces[workspaceIndex].settings = { ...currentSettings };
          workspaceData.workspaces[workspaceIndex].updatedAt = Date.now();
          chrome.storage.local.set({ workspaceData });
        }
      });
    });
  };
  
  // Track mouse position continuously - this works even if user never hovers sidebar
  let isMouseOverSidebar = false;
  let lastKnownMouseX = null;
  let lastKnownMouseY = null;
  
  // Function to check if mouse is over sidebar and handle collapse/expand
  const updateSidebarState = () => {
    const settings = getCurrentSettings();
    if (settings.mode !== 'hovering') {
      return;
    }
    
    // Don't check state during transitions - let animation complete
    if (isTransitioning) {
      return;
    }
    
    // If we don't know mouse position yet, skip
    if (lastKnownMouseX === null || lastKnownMouseY === null) {
      return;
    }
    
    const rect = sidebar.getBoundingClientRect();
    // Add buffer zones: 50px on the side where panel is positioned, 10px on the opposite side
    // This helps when sidebar is animating and mouse might temporarily leave bounds
    const primaryBuffer = 50; // Buffer on the side where panel is positioned
    const secondaryBuffer = 10; // Buffer on the opposite side
    let isOver;
    
    if (settings.position === 'left') {
      // Left sidebar: 50px buffer on left, 10px buffer on right
      isOver = lastKnownMouseX >= (rect.left - primaryBuffer) && 
               lastKnownMouseX <= (rect.right + secondaryBuffer) && 
               lastKnownMouseY >= rect.top && 
               lastKnownMouseY <= rect.bottom;
    } else {
      // Right sidebar: 10px buffer on left, 50px buffer on right
      isOver = lastKnownMouseX >= (rect.left - secondaryBuffer) && 
               lastKnownMouseX <= (rect.right + primaryBuffer) && 
               lastKnownMouseY >= rect.top && 
               lastKnownMouseY <= rect.bottom;
    }
    
    if (isOver) {
      // Mouse is over sidebar (or buffer zone)
      if (!isMouseOverSidebar) {
        isMouseOverSidebar = true;
        // Clear any pending collapse
        if (autoCollapseTimeout) {
          clearTimeout(autoCollapseTimeout);
          autoCollapseTimeout = null;
        }
        // Expand if collapsed
        if (settings.collapsed) {
          setCollapsedState(false);
        }
      }
    } else {
      // Mouse is NOT over sidebar (or buffer zone)
      if (isMouseOverSidebar) {
        isMouseOverSidebar = false;
      }
      
      // If sidebar is expanded and no modal is open, start collapse timer
      if (!settings.collapsed && !isAnyModalOpen() && !isTransitioning) {
        if (autoCollapseTimeout) {
          clearTimeout(autoCollapseTimeout);
        }
        autoCollapseTimeout = setTimeout(() => {
          // Double-check we're not transitioning before collapsing
          if (!isTransitioning) {
            const currentSettings = getCurrentSettings();
            if (currentSettings.mode === 'hovering' && !currentSettings.collapsed && !isAnyModalOpen()) {
              setCollapsedState(true);
            }
          }
          autoCollapseTimeout = null;
        }, AUTO_COLLAPSE_DELAY);
      }
    }
  };
  
  // Track mouse movement on document level (works even if never hovered sidebar)
  const handleDocumentMouseMove = (e) => {
    lastKnownMouseX = e.clientX;
    lastKnownMouseY = e.clientY;
    updateSidebarState();
  };
  
  document.addEventListener('mousemove', handleDocumentMouseMove);
  
  // Also attach sidebar events for immediate response
  sidebar.addEventListener('mouseenter', () => {
    isMouseOverSidebar = true;
    if (autoCollapseTimeout) {
      clearTimeout(autoCollapseTimeout);
      autoCollapseTimeout = null;
    }
    const settings = getCurrentSettings();
    if (settings.mode === 'hovering' && settings.collapsed) {
      setCollapsedState(false);
    }
  });
  
  sidebar.addEventListener('mouseleave', () => {
    // Don't update state immediately if transitioning - wait for animation to complete
    if (!isTransitioning) {
      isMouseOverSidebar = false;
      updateSidebarState();
    }
  });
  
  // Check initial state after sidebar is rendered
  // In hovering mode, collapse immediately by default - will expand when user hovers
  setTimeout(() => {
    const settings = getCurrentSettings();
    if (settings.mode === 'hovering' && !isAnyModalOpen()) {
      // If we know mouse position, check if it's over sidebar
      if (lastKnownMouseX !== null && lastKnownMouseY !== null) {
        updateSidebarState();
      } else {
        // No mouse position known yet - collapse by default
        // Sidebar will expand when user hovers over it
        if (!settings.collapsed) {
          setCollapsedState(true);
        }
      }
    }
  }, 100); // Faster initial check
  
  // Also handle click on collapsed sidebar to expand
  sidebar.addEventListener('click', (e) => {
    // Don't interfere with button clicks
    if (e.target.closest('.wm-icon') || e.target.closest('.wm-settings-btn')) {
      return;
    }
    
    const settings = getCurrentSettings();
    if (settings.mode === 'hovering' && settings.collapsed) {
      setCollapsedState(false);
    }
  });
}

function renderSidebarWithData(position, collapsed) {
  if (document.getElementById('workspace-manager-sidebar')) {
    return;
  }

  const sidebar = document.createElement('div');
  sidebar.id = 'workspace-manager-sidebar';
  sidebar.className = `wm-sidebar wm-sidebar-${position}`;
  sidebarElement = sidebar;
  
  // Apply styles based on current settings
  applySidebarStyles(sidebar, currentSettings);

  chrome.runtime.sendMessage({ type: 'getCurrentWorkspace' }, (response) => {
    const currentWorkspaceId = response?.workspaceId || currentWorkspaces[0]?.id || 'default';
    
    const workspaceHtml = currentWorkspaces
      .map((ws, i) => {
        const gridRow = ws.gridRow !== undefined ? ws.gridRow : i;
        const gridCol = ws.gridCol !== undefined ? ws.gridCol : 0;
        const isActive = ws.id === currentWorkspaceId;
        // Use icon if available, otherwise first letter
        let iconDisplay = ws.name.charAt(0).toUpperCase(); // Default to first letter
        if (ws.icon) {
          const iconTrimmed = ws.icon.trim();
          if (iconTrimmed.startsWith('<svg')) {
            // SVG icon string
            iconDisplay = iconTrimmed;
          } else if (iconTrimmed.startsWith('http') || iconTrimmed.startsWith('data:') || iconTrimmed.startsWith('/')) {
            // Image URL
            iconDisplay = `<img src="${iconTrimmed}" alt="${ws.name}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.parentElement.textContent='${ws.name.charAt(0).toUpperCase()}'">`;
          } else {
            // Emoji or text icon
            iconDisplay = iconTrimmed;
          }
        }
        return `
        <button class="wm-icon ${isActive ? 'active' : ''}" 
                data-workspace-id="${ws.id}" 
                title="${ws.name}"
                style="grid-row: ${gridRow + 1}; grid-column: ${gridCol + 1};">
          ${iconDisplay}
        </button>
      `;
      })
      .join('');

    const bookmarkHtml = currentBookmarks
      .map((bm, i) => {
        const gridRow = bm.gridRow !== undefined ? bm.gridRow : i;
        const gridCol = bm.gridCol !== undefined ? bm.gridCol : 0;
        
        // Determine icon display - custom icon or favicon (Chrome -> Google -> origin -> placeholder)
        let iconHtml = '';
        var faviconUrlEsc = escapeFaviconAttr(bm.url);
        if (bm.icon) {
          const iconTrimmed = bm.icon.trim();
          if (iconTrimmed.startsWith('<svg')) {
            iconHtml = iconTrimmed;
          } else if (iconTrimmed.startsWith('http') || iconTrimmed.startsWith('data:') || iconTrimmed.startsWith('/')) {
            iconHtml = '<img src="' + iconTrimmed + '" alt="' + (bm.title || '').replace(/"/g, '&quot;') + '" data-favicon-url="' + faviconUrlEsc + '" data-favicon-attempt="-1" onerror="window.wmFaviconFallback&&window.wmFaviconFallback(this)">';
          } else {
            iconHtml = '<span style="font-size: 18px; line-height: 1;">' + iconTrimmed + '</span>';
          }
        } else {
          iconHtml = '<img src="' + getFaviconSource(bm.url, 0) + '" alt="' + (bm.title || '').replace(/"/g, '&quot;') + '" data-favicon-url="' + faviconUrlEsc + '" data-favicon-attempt="0" onerror="window.wmFaviconFallback&&window.wmFaviconFallback(this)">';
        }
        
        return `
        <a class="wm-icon wm-bookmark" 
           href="${bm.url}" 
           target="_blank" 
           title="${bm.title}" 
           data-bookmark-id="${bm.id}"
           style="grid-row: ${gridRow + 1}; grid-column: ${gridCol + 1};">
          ${iconHtml}
        </a>
      `;
      })
      .join('');

      const maxWorkspaceRow = currentWorkspaces.length > 0 
        ? Math.max(...currentWorkspaces.map(ws => ws.gridRow !== undefined ? ws.gridRow : 0), -1)
        : -1;
      const maxBookmarkRow = currentBookmarks.length > 0
        ? Math.max(...currentBookmarks.map(bm => bm.gridRow !== undefined ? bm.gridRow : 0), -1)
        : -1;

      sidebar.innerHTML = `
        <div class="wm-taskbar">
          <div class="wm-main-view">
            <div class="wm-section wm-workspaces wm-grid-container">
              ${workspaceHtml}
              <button class="wm-icon wm-add-btn" id="wm-add-workspace-btn" title="Add workspace" style="grid-row: ${maxWorkspaceRow + 2}; grid-column: 1;">+</button>
            </div>
            <div class="wm-divider"></div>
            <div class="wm-section wm-bookmarks wm-grid-container">
              ${bookmarkHtml}
              <button class="wm-icon wm-add-btn" id="wm-add-bookmark-btn" title="Add bookmark" style="grid-row: ${maxBookmarkRow + 2}; grid-column: 1;">+</button>
            </div>
            <div class="wm-divider"></div>
            <div class="wm-settings-container" style="display: flex; justify-content: center; align-items: center; padding: 8px;">
              <button class="wm-icon wm-settings-btn" id="wm-settings-btn" title="Settings">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.61 22a2.25 2.25 0 0 1-1.35-.46L5.19 20a2.37 2.37 0 0 1-.49-3.22 2.06 2.06 0 0 0 .23-1.86l-.06-.16a1.83 1.83 0 0 0-1.12-1.22h-.16a2.34 2.34 0 0 1-1.48-2.94L2.93 8a2.18 2.18 0 0 1 1.12-1.41 2.14 2.14 0 0 1 1.68-.12 1.93 1.93 0 0 0 1.78-.29l.13-.1a1.94 1.94 0 0 0 .73-1.51v-.24A2.32 2.32 0 0 1 10.66 2h2.55a2.26 2.26 0 0 1 1.6.67 2.37 2.37 0 0 1 .68 1.68v.28a1.76 1.76 0 0 0 .69 1.43l.11.08a1.74 1.74 0 0 0 1.59.26l.34-.11A2.26 2.26 0 0 1 21.1 7.8l.79 2.52a2.36 2.36 0 0 1-1.46 2.93l-.2.07A1.89 1.89 0 0 0 19 14.6a2 2 0 0 0 .25 1.65l.26.38a2.38 2.38 0 0 1-.5 3.23L17 21.41a2.24 2.24 0 0 1-3.22-.53l-.12-.17a1.75 1.75 0 0 0-1.5-.78 1.8 1.8 0 0 0-1.43.77l-.23.33A2.25 2.25 0 0 1 9 22a2 2 0 0 1-.39 0zM4.4 11.62a3.83 3.83 0 0 1 2.38 2.5v.12a4 4 0 0 1-.46 3.62.38.38 0 0 0 0 .51L8.47 20a.25.25 0 0 0 .37-.07l.23-.33a3.77 3.77 0 0 1 6.2 0l.12.18a.3.3 0 0 0 .18.12.25.25 0 0 0 .19-.05l2.06-1.56a.36.36 0 0 0 .07-.49l-.26-.38A4 4 0 0 1 17.1 14a3.92 3.92 0 0 1 2.49-2.61l.2-.07a.34.34 0 0 0 .19-.44l-.78-2.49a.35.35 0 0 0-.2-.19.21.21 0 0 0-.19 0l-.34.11a3.74 3.74 0 0 1-3.43-.57L15 7.65a3.76 3.76 0 0 1-1.49-3v-.31a.37.37 0 0 0-.1-.26.31.31 0 0 0-.21-.08h-2.54a.31.31 0 0 0-.29.33v.25a3.9 3.9 0 0 1-1.52 3.09l-.13.1a3.91 3.91 0 0 1-3.63.59.22.22 0 0 0-.14 0 .28.28 0 0 0-.12.15L4 11.12a.36.36 0 0 0 .22.45z"/>
                  <path d="M12 15.5a3.5 3.5 0 1 1 3.5-3.5 3.5 3.5 0 0 1-3.5 3.5zm0-5a1.5 1.5 0 1 0 1.5 1.5 1.5 1.5 0 0 0-1.5-1.5z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
      
    setupSidebarAfterRender(sidebar, position, collapsed);
  });
}

function setupSidebarAfterRender(sidebar, position, collapsed) {
  sidebar.classList.remove('hidden');
  sidebar.classList.remove('wm-auto-collapsed');
  
  // Apply styles to ensure sidebar is visible
  applySidebarStyles(sidebar, currentSettings);
  
  // Setup auto-collapse for hovering mode
  setupAutoCollapse(sidebar);
  
  // If hovering mode, collapse immediately on page load
  if (currentSettings.mode === 'hovering') {
    setTimeout(() => {
      // Directly apply collapsed state without animation on initial load
      const COLLAPSED_WIDTH = 8;
      sidebar.style.transition = 'none'; // No animation for initial state
      sidebar.style.width = COLLAPSED_WIDTH + 'px';
      sidebar.style.minWidth = COLLAPSED_WIDTH + 'px';
      sidebar.style.maxWidth = COLLAPSED_WIDTH + 'px';
      
      if (currentSettings.position === 'left') {
        sidebar.style.left = '0';
        sidebar.style.right = 'auto';
        sidebar.style.marginLeft = '0';
      } else {
        sidebar.style.right = '0';
        sidebar.style.left = 'auto';
        sidebar.style.marginRight = '0';
      }
      
      sidebar.classList.add('wm-auto-collapsed');
      currentSettings.collapsed = true;
      
      // Re-enable transitions after initial collapse
      requestAnimationFrame(() => {
        sidebar.style.transition = '';
      });
    }, 500);
  }
  
  // Apply panel styles after sidebar is set up
  applyPanelStyles(currentSettings);

  // Check if settings panel already exists, remove it if it does
  let settingsPanel = document.getElementById('wm-settings-panel');
  if (settingsPanel) {
    settingsPanel.remove();
  }
  
  // Create new settings panel
  settingsPanel = document.createElement('div');
  settingsPanel.id = 'wm-settings-panel';
  settingsPanel.className = 'wm-panel-overlay wm-panel-large';
  settingsPanel.innerHTML = `
    <div class="wm-panel">
      <div class="wm-panel-header">
        <h2>Settings</h2>
        <button class="wm-panel-close">&times;</button>
      </div>

      <div class="wm-panel-content">
        <div class="wm-panel-section">
          <h3>Mode</h3>
          <div class="wm-setting-item" style="gap: 12px;">
            <label class="wm-radio-option" style="flex: 1;">
              <input type="radio" name="wm-mode" value="fixed">
              <span>Fixed</span>
            </label>
            <label class="wm-radio-option" style="flex: 1;">
              <input type="radio" name="wm-mode" value="hovering">
              <span>Hovering</span>
            </label>
          </div>
        </div>

        <div class="wm-panel-section">
          <h3>Position</h3>
          <div class="wm-setting-item" style="gap: 12px;">
            <label class="wm-radio-option" style="flex: 1;">
              <input type="radio" name="wm-position" value="left">
              <span>Left</span>
            </label>
            <label class="wm-radio-option" style="flex: 1;">
              <input type="radio" name="wm-position" value="right">
              <span>Right</span>
            </label>
          </div>
        </div>

        <div class="wm-panel-section">
          <h3>Width</h3>
          <div class="wm-setting-item wm-slider-item">
            <label class="wm-slider-label">
              <span>Sidebar Width</span>
              <span class="wm-slider-value" id="wm-width-value">56px</span>
            </label>
            <input type="range" id="wm-width-slider" min="40" max="80" value="52" step="1" class="wm-slider">
          </div>
        </div>

        <div class="wm-panel-section">
          <h3>Margins (Hovering Mode)</h3>
          <div class="wm-setting-item wm-slider-item">
            <label class="wm-slider-label">
              <span>From Side</span>
              <span class="wm-slider-value" id="wm-margin-side-value">10px</span>
            </label>
            <input type="range" id="wm-margin-side" min="0" max="50" value="10" step="1" class="wm-slider">
          </div>
          <div class="wm-setting-item wm-slider-item">
            <label class="wm-slider-label">
              <span>From Top</span>
              <span class="wm-slider-value" id="wm-margin-top-value">10px</span>
            </label>
            <input type="range" id="wm-margin-top" min="0" max="50" value="10" step="1" class="wm-slider">
          </div>
          <div class="wm-setting-item wm-slider-item">
            <label class="wm-slider-label">
              <span>From Bottom</span>
              <span class="wm-slider-value" id="wm-margin-bottom-value">10px</span>
            </label>
            <input type="range" id="wm-margin-bottom" min="0" max="50" value="10" step="1" class="wm-slider">
          </div>
        </div>

        <div class="wm-panel-section">
          <h3>Border Radius</h3>
          <div class="wm-setting-item wm-slider-item">
            <label class="wm-slider-label">
              <span>Panel</span>
              <span class="wm-slider-value" id="wm-border-radius-value">30px</span>
            </label>
            <input type="range" id="wm-border-radius" min="0" max="50" value="30" step="1" class="wm-slider">
          </div>
          <div class="wm-setting-item wm-slider-item">
            <label class="wm-slider-label">
              <span>Icons</span>
              <span class="wm-slider-value" id="wm-icon-border-radius-value">8px</span>
            </label>
            <input type="range" id="wm-icon-border-radius" min="0" max="25" value="8" step="1" class="wm-slider">
          </div>
        </div>

        <div class="wm-panel-section">
          <h3>Theme</h3>
          <div id="wm-theme-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; margin-bottom: 16px;">
            <!-- Themes will be populated here -->
          </div>
          <div id="wm-custom-colors-section" style="display: none; margin-top: 12px;">
            <div class="wm-setting-item">
              <label style="flex: 1;">
                <span style="margin-right: 12px;">Background</span>
                <input type="color" id="wm-bg-color" value="#252526">
              </label>
            </div>
            <div class="wm-setting-item">
              <label style="flex: 1;">
                <span style="margin-right: 12px;">Icon Background</span>
                <input type="color" id="wm-icon-bg-color" value="#2d2d2d">
              </label>
            </div>
            <div class="wm-setting-item">
              <label style="flex: 1;">
                <span style="margin-right: 12px;">Icon Text</span>
                <input type="color" id="wm-icon-text-color" value="#d4d4d4">
              </label>
            </div>
            <div class="wm-setting-item">
              <label style="flex: 1;">
                <span style="margin-right: 12px;">Accent Color</span>
                <input type="color" id="wm-accent-color" value="#007acc">
              </label>
            </div>
          </div>
        </div>

        <div class="wm-panel-section">
          <h3>Alignment</h3>
          <div class="wm-setting-item" style="gap: 12px;">
            <label class="wm-radio-option" style="flex: 1;">
              <input type="radio" name="wm-alignment" value="top">
              <span>Top</span>
            </label>
            <label class="wm-radio-option" style="flex: 1;">
              <input type="radio" name="wm-alignment" value="bottom">
              <span>Bottom</span>
            </label>
          </div>
        </div>

        <div class="wm-panel-section">
          <h3>New tab URL</h3>
          <div class="wm-setting-item">
            <label class="wm-slider-label" style="flex-direction: column; align-items: stretch; gap: 6px;">
              <span>Opens when you create a new tab</span>
              <input type="url" id="wm-new-tab-url" class="wm-form-input" placeholder="https://www.google.com/" style="width: 100%; box-sizing: border-box;">
            </label>
          </div>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(settingsPanel);

  sidebar.querySelectorAll('[data-workspace-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!isDragging) {
        const workspaceId = btn.dataset.workspaceId;
        switchWorkspace(workspaceId);
      }
    });
    btn.addEventListener('contextmenu', handleWorkspaceContextMenu);
  });

  sidebar.querySelectorAll('[data-bookmark-id]').forEach(btn => {
    btn.addEventListener('contextmenu', handleBookmarkContextMenu);
  });

  setupDragAndDrop(sidebar, '.wm-workspaces', '[data-workspace-id]', 'workspaces');
  setupDragAndDrop(sidebar, '.wm-bookmarks', '[data-bookmark-id]', 'bookmarks');
  
  sidebar.querySelectorAll('[data-bookmark-id]').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (isDragging || dragJustEnded) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    });
  });

  const addWorkspaceBtn = sidebar.querySelector('#wm-add-workspace-btn');
  if (addWorkspaceBtn) {
    addWorkspaceBtn.addEventListener('click', () => {
      // Close all other modals/panels first
      closeAllModals();
      
      // Create a custom modal with name and icon picker together
      let modal = document.getElementById('wm-form-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wm-form-modal';
        modal.className = 'wm-panel-overlay';
        document.body.appendChild(modal);
      }
      
      modal.innerHTML = `
        <div class="wm-panel" style="max-width: 500px;">
          <div class="wm-panel-header">
            <h2>Add Workspace</h2>
            <button class="wm-panel-close">&times;</button>
          </div>
          <div class="wm-panel-content">
            <div class="wm-form-group">
              <label class="wm-form-label">Workspace Name</label>
              <input type="text" id="wm-workspace-name-input" class="wm-form-input" placeholder="Enter workspace name">
            </div>
            <div class="wm-form-group">
              <label class="wm-form-label">Icon (Optional)</label>
              <input type="text" id="wm-workspace-icon-input" class="wm-form-input" placeholder="Enter URL or emoji" style="margin-bottom: 8px;">
              <div class="wm-icon-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px;">
                ${ICON_PRESETS.map(icon => `
                  <button class="wm-icon-preset" style="width: 40px; height: 40px; border: 1px solid #3e3e42; background: #2d2d2d; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #d4d4d4; padding: 0;">${icon}</button>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="wm-modal-footer" style="padding: 20px; border-top: 1px solid #3e3e42; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="wm-form-cancel" style="padding: 8px 16px; background: #3e3e42; border: none; border-radius: 4px; color: #d4d4d4; cursor: pointer;">Cancel</button>
            <button class="wm-form-submit" style="padding: 8px 16px; background: #007acc; border: none; border-radius: 4px; color: #ffffff; cursor: pointer;">Create</button>
          </div>
        </div>
      `;
      
      // Apply panel positioning
      if (window.wmPanelPositionUpdater) {
        window.wmPanelPositionUpdater();
        setTimeout(() => {
          modal.classList.add('active');
        }, 10);
      } else {
        modal.classList.add('active');
      }
      
      // Icon preset clicks
      modal.querySelectorAll('.wm-icon-preset').forEach((btn, index) => {
        btn.addEventListener('click', () => {
          const iconInput = modal.querySelector('#wm-workspace-icon-input');
          if (iconInput) iconInput.value = ICON_PRESETS[index];
        });
      });
      
      // Close handlers
      modal.querySelector('.wm-panel-close').addEventListener('click', () => closeFormModal());
      modal.querySelector('.wm-form-cancel').addEventListener('click', () => closeFormModal());
      
      // Submit handler
      modal.querySelector('.wm-form-submit').addEventListener('click', () => {
        const nameInput = modal.querySelector('#wm-workspace-name-input');
        const iconInput = modal.querySelector('#wm-workspace-icon-input');
        
        if (nameInput && nameInput.value.trim()) {
          const maxRow = Math.max(...currentWorkspaces.map(ws => ws.gridRow || 0), -1);
          const newGridPos = { row: maxRow + 1, col: 0 };
          
          const newWorkspace = {
            id: `ws-${Date.now()}`,
            name: nameInput.value.trim(),
            icon: iconInput && iconInput.value.trim() ? iconInput.value.trim() : undefined,
            gridRow: newGridPos.row,
            gridCol: newGridPos.col
          };
          currentWorkspaces.push(newWorkspace);
          closeFormModal();
          saveData();
        }
      });
      
      // Focus name input
      const nameInput = modal.querySelector('#wm-workspace-name-input');
      if (nameInput) nameInput.focus();
    });
  }

  const addBookmarkBtn = sidebar.querySelector('#wm-add-bookmark-btn');
  if (addBookmarkBtn) {
    addBookmarkBtn.addEventListener('click', () => {
      // Close all other modals/panels first
      closeAllModals();
      
      // Create a custom modal with current page option and icon picker
      let modal = document.getElementById('wm-form-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wm-form-modal';
        modal.className = 'wm-panel-overlay';
        document.body.appendChild(modal);
      }
      
      modal.innerHTML = `
        <div class="wm-panel" style="max-width: 500px;">
          <div class="wm-panel-header">
            <h2>Add Bookmark</h2>
            <button class="wm-panel-close">&times;</button>
          </div>
          <div class="wm-panel-content">
            <div class="wm-form-group">
              <label class="wm-form-label">Title</label>
              <input type="text" id="wm-bookmark-title-input" class="wm-form-input" placeholder="Bookmark title">
            </div>
            <div class="wm-form-group">
              <label class="wm-form-label">URL</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="wm-bookmark-url-input" class="wm-form-input" placeholder="https://example.com" style="flex: 1;">
                <button id="wm-bookmark-current-page-btn" style="padding: 8px 16px; background: #3e3e42; border: none; border-radius: 4px; color: #d4d4d4; cursor: pointer; white-space: nowrap;">Use Current Page</button>
              </div>
            </div>
            <div class="wm-form-group">
              <button id="wm-toggle-icon-picker" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: transparent; border: 1px solid #3e3e42; border-radius: 4px; color: #888; cursor: pointer; font-size: 13px; width: 100%; text-align: left;">
                <span id="wm-icon-toggle-arrow" style="transition: transform 0.2s;">▶</span>
                <span>Custom Icon (Optional)</span>
              </button>
              <div id="wm-icon-picker-section" style="display: none; margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px;">
                <p style="font-size: 11px; color: #888; margin-bottom: 8px;">Leave empty to auto-fetch favicon from website</p>
                <input type="text" id="wm-bookmark-icon-input" class="wm-form-input" placeholder="Enter URL, emoji, or select preset" style="margin-bottom: 8px;">
                <div class="wm-icon-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px;">
                  ${ICON_PRESETS.map(icon => `
                    <button class="wm-icon-preset wm-bookmark-icon-preset" style="width: 40px; height: 40px; border: 1px solid #3e3e42; background: #2d2d2d; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #d4d4d4; padding: 0;">${icon}</button>
                  `).join('')}
                </div>
                <button id="wm-bookmark-clear-icon-btn" style="margin-top: 8px; padding: 6px 12px; background: transparent; border: 1px solid #3e3e42; border-radius: 4px; color: #888; cursor: pointer; font-size: 12px;">Clear (use favicon)</button>
              </div>
            </div>
          </div>
          <div class="wm-modal-footer" style="padding: 20px; border-top: 1px solid #3e3e42; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="wm-form-cancel" style="padding: 8px 16px; background: #3e3e42; border: none; border-radius: 4px; color: #d4d4d4; cursor: pointer;">Cancel</button>
            <button class="wm-form-submit" style="padding: 8px 16px; background: #007acc; border: none; border-radius: 4px; color: #ffffff; cursor: pointer;">Add</button>
          </div>
        </div>
      `;
      
      // Apply panel positioning
      if (window.wmPanelPositionUpdater) {
        window.wmPanelPositionUpdater();
        setTimeout(() => {
          modal.classList.add('active');
        }, 10);
      } else {
        modal.classList.add('active');
      }
      
      // Toggle icon picker visibility
      const toggleIconBtn = modal.querySelector('#wm-toggle-icon-picker');
      const iconPickerSection = modal.querySelector('#wm-icon-picker-section');
      const toggleArrow = modal.querySelector('#wm-icon-toggle-arrow');
      if (toggleIconBtn && iconPickerSection && toggleArrow) {
        toggleIconBtn.addEventListener('click', () => {
          const isHidden = iconPickerSection.style.display === 'none';
          iconPickerSection.style.display = isHidden ? 'block' : 'none';
          toggleArrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
        });
      }
      
      // Icon preset clicks for bookmark
      modal.querySelectorAll('.wm-bookmark-icon-preset').forEach((btn, index) => {
        btn.addEventListener('click', () => {
          const iconInput = modal.querySelector('#wm-bookmark-icon-input');
          if (iconInput) iconInput.value = ICON_PRESETS[index];
        });
      });
      
      // Clear icon button
      const clearIconBtn = modal.querySelector('#wm-bookmark-clear-icon-btn');
      if (clearIconBtn) {
        clearIconBtn.addEventListener('click', () => {
          const iconInput = modal.querySelector('#wm-bookmark-icon-input');
          if (iconInput) iconInput.value = '';
        });
      }
      
      // Current page button
      const currentPageBtn = modal.querySelector('#wm-bookmark-current-page-btn');
      if (currentPageBtn) {
        currentPageBtn.addEventListener('click', () => {
          const titleInput = modal.querySelector('#wm-bookmark-title-input');
          const urlInput = modal.querySelector('#wm-bookmark-url-input');
          if (titleInput) titleInput.value = document.title;
          if (urlInput) urlInput.value = window.location.href;
        });
      }
      
      // Close handlers
      modal.querySelector('.wm-panel-close').addEventListener('click', () => closeFormModal());
      modal.querySelector('.wm-form-cancel').addEventListener('click', () => closeFormModal());
      
      // Submit handler
      modal.querySelector('.wm-form-submit').addEventListener('click', () => {
        const titleInput = modal.querySelector('#wm-bookmark-title-input');
        const urlInput = modal.querySelector('#wm-bookmark-url-input');
        const iconInput = modal.querySelector('#wm-bookmark-icon-input');
        
        if (titleInput && titleInput.value.trim() && urlInput && urlInput.value.trim()) {
          const maxRow = Math.max(...currentBookmarks.map(bm => bm.gridRow || 0), -1);
          const newGridPos = { row: maxRow + 1, col: 0 };
          
          currentBookmarks.push({ 
            id: `bm-${Date.now()}`,
            title: titleInput.value.trim(),
            url: urlInput.value.trim(),
            icon: iconInput && iconInput.value.trim() ? iconInput.value.trim() : undefined,
            gridRow: newGridPos.row,
            gridCol: newGridPos.col
          });
          closeFormModal();
          saveData();
        }
      });
      
      // Focus title input
      const titleInput = modal.querySelector('#wm-bookmark-title-input');
      if (titleInput) titleInput.focus();
    });
  }

  const addCurrentPageBtn = sidebar.querySelector('#wm-add-current-page-btn');
  if (addCurrentPageBtn) {
    addCurrentPageBtn.addEventListener('click', () => {
      const maxRow = Math.max(...currentBookmarks.map(bm => bm.gridRow || 0), -1);
      const newGridPos = { row: maxRow + 1, col: 0 };
      
      currentBookmarks.push({ 
        id: `bm-${Date.now()}`,
        title: document.title,
        url: window.location.href,
        gridRow: newGridPos.row,
        gridCol: newGridPos.col
      });
      saveData();
    });
  }

  const settingsBtn = sidebar.querySelector('#wm-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      // Close all other modals/panels first
      closeAllModals();
      // Cancel any pending collapse
      cancelPendingCollapse();
      renderSettingsPanel();
      // Update panel position and styling before showing
      if (window.wmPanelPositionUpdater) {
        window.wmPanelPositionUpdater();
        // Small delay to ensure styles are applied before animation
        setTimeout(() => {
          settingsPanel.classList.add('active');
        }, 10);
      } else {
        settingsPanel.classList.add('active');
      }
    });
  }

  // Ensure document.body exists before appending
  if (!document.body) {
    // Wait for body to be available
    const bodyCheck = setInterval(() => {
      if (document.body) {
        clearInterval(bodyCheck);
        document.body.appendChild(sidebar);
      }
    }, 100);
    // Clear after 10 seconds to prevent infinite loop
    setTimeout(() => clearInterval(bodyCheck), 10000);
    return;
  }
  
  document.body.appendChild(sidebar);
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'RELOAD_SIDEBAR') {
    reloadSidebar();
  } else if (request.type === 'TOGGLE_SIDEBAR') {
    if (sidebarElement) {
      sidebarElement.classList.toggle('hidden');
    }
  } else if (request.type === 'PING') {
    // Respond to ping to indicate content script is loaded
    sendResponse({ loaded: true });
  }
});

// Initialize sidebar when DOM is ready
function initSidebar() {
  try {
    // Check if sidebar already exists
    const existingSidebar = document.getElementById('workspace-manager-sidebar');
    if (existingSidebar) {
      return;
    }
    
    // Check if document.body exists
    if (!document.body) {
      return;
    }
    
    // Try to create sidebar
    createSidebar();
  } catch (error) {
    // Retry after a delay
    setTimeout(() => {
      try {
        if (!document.getElementById('workspace-manager-sidebar')) {
          createSidebar();
        }
      } catch (retryError) {
        // Ignore retry errors
      }
    }, 500);
  }
}

try {
  // Try immediate initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSidebar();
    });
  } else {
    initSidebar();
  }
  
  // Multiple retry attempts for dynamically loaded pages
  setTimeout(() => initSidebar(), 100);
  setTimeout(() => initSidebar(), 300);
  setTimeout(() => initSidebar(), 500);
  setTimeout(() => initSidebar(), 1000);
  setTimeout(() => initSidebar(), 2000);
} catch (error) {
  // Ignore initialization errors
}

})(); // End IIFE

