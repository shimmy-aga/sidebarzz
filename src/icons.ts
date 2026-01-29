// Icon pack system for black & white simplistic icons

export interface IconPack {
  id: string;
  name: string;
  icons: {
    [key: string]: string; // SVG content
  };
}

// Black & White Minimalist Icon Pack
export const MINIMALIST_ICON_PACK: IconPack = {
  id: 'minimalist',
  name: 'Minimalist',
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
    </svg>`,
  }
};

// Simple Line Icon Pack (even more minimal)
export const SIMPLE_LINE_ICON_PACK: IconPack = {
  id: 'simple-line',
  name: 'Simple Line',
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
    </svg>`,
  }
};

// Ultra Minimal Icon Pack (just lines, no fills)
export const ULTRA_MINIMAL_ICON_PACK: IconPack = {
  id: 'ultra-minimal',
  name: 'Ultra Minimal',
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
    </svg>`,
  }
};

export const ICON_PACKS: IconPack[] = [
  MINIMALIST_ICON_PACK,
  SIMPLE_LINE_ICON_PACK,
  ULTRA_MINIMAL_ICON_PACK
];

export function getIconPack(id: string): IconPack {
  return ICON_PACKS.find(pack => pack.id === id) || MINIMALIST_ICON_PACK;
}

export function getIcon(iconPack: IconPack, iconName: string): string {
  return iconPack.icons[iconName] || iconPack.icons.link || '';
}
