/**
 * Theme Manager - Handles Dark Mode and Light Mode for Admin Dashboard
 * Supports localStorage persistence and system preference detection
 */

class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'admin-dashboard-theme';
    this.LIGHT_MODE = 'light';
    this.DARK_MODE = 'dark';
    this.SYSTEM_MODE = 'system';
    
    this.init();
  }

  /**
   * Initialize theme manager
   */
  init() {
    // Get saved theme from localStorage or use system preference
    const savedTheme = this.getSavedTheme();
    const preferredTheme = savedTheme || this.getSystemPreference();
    
    // Apply the theme
    this.applyTheme(preferredTheme);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!this.getSavedTheme()) {
          this.applyTheme(e.matches ? this.DARK_MODE : this.LIGHT_MODE);
        }
      });
    }
  }

  /**
   * Get saved theme from localStorage
   */
  getSavedTheme() {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  /**
   * Get system theme preference
   */
  getSystemPreference() {
    if (!window.matchMedia) return this.LIGHT_MODE;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? this.DARK_MODE : this.LIGHT_MODE;
  }

  /**
   * Get current active theme
   */
  getCurrentTheme() {
    return document.documentElement.classList.contains('dark-mode') ? this.DARK_MODE : this.LIGHT_MODE;
  }

  /**
   * Apply theme to document
   */
  applyTheme(theme) {
    if (theme === this.DARK_MODE) {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
    }
    
    // Store the preference
    localStorage.setItem(this.STORAGE_KEY, theme);
    
    // Update button state
    this.updateToggleButton(theme);
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  }

  /**
   * Toggle between light and dark mode
   */
  toggleTheme() {
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === this.LIGHT_MODE ? this.DARK_MODE : this.LIGHT_MODE;
    
    // Add animation class
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.classList.add('rotating');
      setTimeout(() => btn.classList.remove('rotating'), 600);
    }
    
    // Apply new theme
    this.applyTheme(newTheme);
  }

  /**
   * Set theme to light mode
   */
  setLightMode() {
    this.applyTheme(this.LIGHT_MODE);
  }

  /**
   * Set theme to dark mode
   */
  setDarkMode() {
    this.applyTheme(this.DARK_MODE);
  }

  /**
   * Update toggle button appearance
   */
  updateToggleButton(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    
    if (theme === this.DARK_MODE) {
      btn.textContent = '☀️';
      btn.title = 'Switch to Light Mode';
      btn.setAttribute('data-theme', 'dark');
    } else {
      btn.textContent = '🌙';
      btn.title = 'Switch to Dark Mode';
      btn.setAttribute('data-theme', 'light');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        this.toggleTheme();
      });
      
      // Add keyboard shortcut (Ctrl/Cmd + Shift + T)
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyT') {
          e.preventDefault();
          this.toggleTheme();
        }
      });
    }
  }

  /**
   * Listen for theme changes (for external components)
   */
  onThemeChange(callback) {
    window.addEventListener('themeChanged', (e) => {
      callback(e.detail.theme);
    });
  }
}

// Initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
  });
} else {
  window.themeManager = new ThemeManager();
}

