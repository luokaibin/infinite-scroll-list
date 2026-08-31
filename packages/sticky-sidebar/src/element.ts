/**
 * Sticky Sidebar Web Component
 * A responsive Web Component that provides sticky sidebar functionality with configurable breakpoints.
 * The component only calculates and sets the top value, styling is controlled externally.
 */

// 元素定义：本文件仅声明类，注册逻辑在 register.ts
// SSR-safe 基类：浏览器环境等同 extends HTMLElement；服务端（Node/SSR）环境
// HTMLElement 不存在，退化为空基类，保证模块可被服务端安全导入（no-op）
const CustomElementBase =
  typeof HTMLElement !== "undefined"
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);

export class StickySidebar extends CustomElementBase {
  private _minWidth: number;
  private _mediaQuery: MediaQueryList | null;
  private _resizeObserver: ResizeObserver | null;
  private _windowResizeHandler: (() => void) | null;
  private _isSticky: boolean;
  private _rafId: number | null;
  private _isCalculating: boolean;
  private _originalTop: string | null = null;

  constructor() {
    super();

    // Initialize properties
    this._minWidth = 1024; // Default breakpoint
    this._mediaQuery = null;
    this._resizeObserver = null;
    this._windowResizeHandler = null;
    this._isSticky = false;
    this._rafId = null;
    this._isCalculating = false;
  }

  /**
   * Define which attributes to observe for changes
   */
  static get observedAttributes(): string[] {
    return ['min-width'];
  }

  /**
   * Called when the element is added to the DOM
   */
  connectedCallback() {
    
    // Record original top value before any modifications
    this._originalTop = this.style.top || null;
    
    // Get min-width attribute value
    const minWidthAttr = this.getAttribute('min-width');
    if (minWidthAttr) {
      this._minWidth = parseInt(minWidthAttr) || 1024;
    }
    
    // Initialize the component
    this._initialize();
  }

  /**
   * Called when the element is removed from the DOM
   */
  disconnectedCallback() {
    
    // Clean up observers
    this._cleanup();
  }

  /**
   * Called when observed attributes change
   */
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (name === 'min-width' && oldValue !== newValue) {
      const validatedBreakpoint = this._validateBreakpoint(newValue);
      this._minWidth = validatedBreakpoint;
      
      // Only reinitialize if the breakpoint actually changed
      if (oldValue !== validatedBreakpoint.toString()) {
        this._cleanup();
        this._initialize();
      }
    }
  }


  /**
   * Initialize the component
   */
  _initialize() {
    // Set up media query for breakpoint detection
    this._setupMediaQuery();
    
    // Set up resize observer
    this._setupResizeObserver();
    
    // Initial calculation
    this._calculateStickyBehavior();
  }


  /**
   * Set up media query for breakpoint detection
   */
  _setupMediaQuery() {
    // Validate breakpoint value
    const validatedBreakpoint = this._validateBreakpoint(this._minWidth);
    if (validatedBreakpoint !== this._minWidth) {
      console.warn(`Invalid breakpoint ${this._minWidth}, using ${validatedBreakpoint}`);
      this._minWidth = validatedBreakpoint;
    }
    
    this._mediaQuery = window.matchMedia(`(min-width: ${this._minWidth}px)`);
    
    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      this._handleBreakpointChange(e.matches);
    };
    
    this._mediaQuery.addEventListener('change', handleMediaChange);
    
    // Initial check
    handleMediaChange(this._mediaQuery);
  }

  /**
   * Validate breakpoint value
   */
  _validateBreakpoint(breakpoint: string | number | null): number {
    const num = parseInt(String(breakpoint), 10);
    if (isNaN(num) || num < 0) {
      console.warn(`Invalid breakpoint: ${breakpoint}, using default 1024`);
      return 1024;
    }
    if (num > 3840) { // 4K width limit
      console.warn(`Breakpoint too large: ${breakpoint}, capping at 3840`);
      return 3840;
    }
    return num;
  }

  /**
   * Handle breakpoint change
   */
  _handleBreakpointChange(isAboveBreakpoint) {
    if (isAboveBreakpoint) {
      this._enableSticky();
    } else {
      this._disableSticky();
    }
  }

  /**
   * Get current breakpoint status
   */
  getBreakpointStatus() {
    return {
      breakpoint: this._minWidth,
      currentWidth: window.innerWidth,
      isAboveBreakpoint: this._mediaQuery ? this._mediaQuery.matches : false,
      mediaQuery: this._mediaQuery ? this._mediaQuery.media : null,
      isStickyActive: this._isSticky
    };
  }

  /**
   * Set breakpoint programmatically
   */
  setBreakpoint(breakpoint: string | number): number {
    const validatedBreakpoint = this._validateBreakpoint(breakpoint);
    this.setAttribute('min-width', validatedBreakpoint.toString());
    return validatedBreakpoint;
  }


  /**
   * Restore original top value
   */
  _restoreOriginalTop() {
    if (this._originalTop === null) {
      // Originally had no top value, remove the property
      this.style.removeProperty('top');
    } else {
      // Originally had a top value, restore it
      this.style.top = this._originalTop;
    }
  }

  /**
   * Force recalculation
   */
  forceRecalculation(): void {
    this._calculateStickyBehavior();
  }

  /**
   * Set up resize observer for size changes
   */
  _setupResizeObserver() {
    // Set up ResizeObserver for element size changes
    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver((entries) => {
        this._calculateStickyBehavior();
      });
      
      this._resizeObserver.observe(this);
    } else {
      console.warn('ResizeObserver not supported');
    }
    
    // Set up window resize listener
    this._windowResizeHandler = () => {
      this._calculateStickyBehavior();
    };
    
    window.addEventListener('resize', this._windowResizeHandler);
  }


  /**
   * Calculate and apply sticky behavior with RAF optimization
   */
  _calculateStickyBehavior() {
    // Prevent multiple simultaneous calculations
    if (this._isCalculating) {
      return;
    }
    
    // Cancel existing RAF
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }
    
    // Use requestAnimationFrame for optimal performance
    this._rafId = requestAnimationFrame(() => {
      try {
        this._isCalculating = true;
        
        // Check if component is still connected to DOM
        if (!this.isConnected) {
          return;
        }
        
        // Check if we should activate sticky behavior
        if (!this._mediaQuery || !this._mediaQuery.matches) {
          this._disableSticky();
          return;
        }
        
        this._enableSticky();
        
      } catch (error) {
        console.error('Sticky calculation error:', error);
      } finally {
        this._isCalculating = false;
        this._rafId = null;
      }
    });
  }


  /**
   * Enable sticky behavior
   */
  _enableSticky() {
    try {
      // Get content height and viewport height
      const contentHeight = this._getContentHeight();
      const viewportHeight = this._getViewportHeight();
      
      
      // Boundary case: if content height is 0 or invalid, don't apply sticky
      if (contentHeight <= 0) {
        this._restoreOriginalTop();
        this._isSticky = false;
        return;
      }
      
      if (contentHeight > viewportHeight) {
        // Calculate offset to prevent content from being cut off
        const offset = contentHeight - viewportHeight;
        this.style.top = `-${offset}px`;
      } else {
        // Content fits in viewport, restore original top value
        this._restoreOriginalTop();
      }
      
      this._isSticky = true;
      
    } catch (error) {
      console.error('Enable sticky error:', error);
    }
  }

  /**
   * Get the actual content height of the sidebar
   */
  _getContentHeight() {
    try {
      // Use getBoundingClientRect for more accurate height measurement
      const rect = this.getBoundingClientRect();
      const height = Math.max(rect.height, this.scrollHeight);
      
      // Validate height
      if (isNaN(height) || height < 0) {
        console.warn('Invalid content height calculated:', height);
        return 0;
      }
      
      return height;
      
    } catch (error) {
      console.error('Get content height error:', error);
      return 0;
    }
  }

  /**
   * Get viewport height with fallback
   */
  _getViewportHeight() {
    try {
      const height = window.innerHeight || document.documentElement.clientHeight || 0;
      
      if (isNaN(height) || height <= 0) {
        console.warn('Invalid viewport height:', height);
        return 1024; // Default fallback
      }
      
      return height;
      
    } catch (error) {
      console.error('Get viewport height error:', error);
      return 1024; // Default fallback
    }
  }

  /**
   * Disable sticky behavior
   */
  _disableSticky() {
    try {
      this._restoreOriginalTop();
      this._isSticky = false;
      
    } catch (error) {
      console.error('Disable sticky error:', error);
    }
  }

  /**
   * Clean up observers and event listeners
   */
  _cleanup() {
    try {
      // Clear RAF
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      
      // Reset calculation state
      this._isCalculating = false;
      
      if (this._mediaQuery) {
        // Remove all event listeners by cloning the MediaQueryList
        const newMediaQuery = window.matchMedia(this._mediaQuery.media);
        this._mediaQuery = newMediaQuery;
      }
      
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
      
      if (this._windowResizeHandler) {
        window.removeEventListener('resize', this._windowResizeHandler);
        this._windowResizeHandler = null;
      }
      
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}
