/**
 * =================================================
 * 📱 承億蔬果外送 - 行動端體驗增強JavaScript
 * by SUB AGENT團隊行動端優化專家
 * =================================================
 */

(function() {
  'use strict';

  // =================================================
  // 🔧 初始化和設備檢測
  // =================================================

  const MobileEnhancements = {
    // 設備檢測
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
    isTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
    
    // 螢幕尺寸
    getScreenSize: () => {
      const width = window.innerWidth;
      if (width <= 375) return 'small';
      if (width <= 414) return 'medium';
      return 'large';
    },

    // 初始化
    init: function() {
      console.log('🚀 行動端增強功能初始化...');
      
      // 等待DOM加載完成
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    },

    // 設置所有功能
    setup: function() {
      this.addDeviceClasses();
      this.setupTouchFeedback();
      this.setupScrollEnhancements();
      this.setupFormEnhancements();
      this.setupCartEnhancements();
      this.setupAccessibility();
      this.setupPerformanceOptimizations();
      
      console.log('✅ 行動端增強功能載入完成');
    },

    // 添加設備類別
    addDeviceClasses: function() {
      const body = document.body;
      
      if (this.isIOS) body.classList.add('is-ios');
      if (this.isAndroid) body.classList.add('is-android');
      if (this.isMobile) body.classList.add('is-mobile');
      if (this.isTouch) body.classList.add('is-touch');
      
      body.classList.add(`screen-${this.getScreenSize()}`);
      
      // 為調試添加類別
      if (window.location.search.includes('debug=mobile')) {
        body.classList.add('mobile-debug');
      }
    }
  };

  // =================================================
  // 🎯 觸控回饋系統
  // =================================================

  MobileEnhancements.setupTouchFeedback = function() {
    // 需要觸控回饋的元素選擇器
    const touchSelectors = [
      'button',
      '.add-to-cart-btn',
      '.category-tab',
      '.product-card',
      '.cart-button',
      '.quantity-btn',
      '.remove-item',
      '.checkout-btn',
      '.submit-order-btn',
      '.payment-method',
      '.delivery-option',
      '[role="button"]',
      'input[type="submit"]',
      'input[type="button"]'
    ];

    touchSelectors.forEach(selector => {
      document.addEventListener('touchstart', (e) => {
        const target = e.target.closest(selector);
        if (target && !target.disabled && !target.classList.contains('no-touch-feedback')) {
          this.addTouchActive(target);
        }
      }, { passive: true });

      document.addEventListener('touchend', (e) => {
        const target = e.target.closest(selector);
        if (target) {
          this.removeTouchActive(target);
        }
      }, { passive: true });

      document.addEventListener('touchcancel', (e) => {
        const target = e.target.closest(selector);
        if (target) {
          this.removeTouchActive(target);
        }
      }, { passive: true });
    });

    // 為所有觸控元素添加標記類別
    document.querySelectorAll(touchSelectors.join(',')).forEach(element => {
      element.classList.add('touch-target-check');
    });
  };

  // 添加觸控活躍狀態
  MobileEnhancements.addTouchActive = function(element) {
    element.classList.add('touch-active');
    
    // 觸覺回饋 (如果支援)
    if (navigator.vibrate) {
      navigator.vibrate(10); // 輕微震動10ms
    }
    
    // 確保狀態會被移除
    setTimeout(() => {
      this.removeTouchActive(element);
    }, 150);
  };

  // 移除觸控活躍狀態
  MobileEnhancements.removeTouchActive = function(element) {
    element.classList.remove('touch-active');
  };

  // =================================================
  // 🌊 滾動體驗優化
  // =================================================

  MobileEnhancements.setupScrollEnhancements = function() {
    // 防止過度滾動導致的頁面彈跳
    document.body.style.overscrollBehavior = 'none';
    
    // 優化分類標籤滾動
    const categoryTabs = document.querySelector('.category-tabs');
    if (categoryTabs) {
      // 啟用動量滾動
      categoryTabs.style.webkitOverflowScrolling = 'touch';
      
      // 平滑滾動到活躍標籤
      const activeTab = categoryTabs.querySelector('.category-tab.active');
      if (activeTab) {
        setTimeout(() => {
          activeTab.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          });
        }, 100);
      }
    }

    // 購物車滾動優化
    const cartContent = document.querySelector('.cart-content');
    if (cartContent) {
      cartContent.style.webkitOverflowScrolling = 'touch';
    }

    // 防止iOS Safari地址欄影響視窗高度
    if (this.isIOS) {
      this.setupIOSViewportFix();
    }
  };

  // iOS視窗高度修正
  MobileEnhancements.setupIOSViewportFix = function() {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', () => {
      setTimeout(setViewportHeight, 100);
    });
  };

  // =================================================
  // 📝 表單輸入增強
  // =================================================

  MobileEnhancements.setupFormEnhancements = function() {
    // 防止iOS縮放
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      // 確保字體大小至少16px以防止iOS縮放
      if (this.isIOS) {
        const computedStyle = getComputedStyle(input);
        const fontSize = parseFloat(computedStyle.fontSize);
        if (fontSize < 16) {
          input.style.fontSize = '16px';
        }
      }

      // 增強焦點處理
      input.addEventListener('focus', (e) => {
        e.target.classList.add('input-focused');
        
        // iOS Safari滾動修正
        if (this.isIOS) {
          setTimeout(() => {
            e.target.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }, 300);
        }
      });

      input.addEventListener('blur', (e) => {
        e.target.classList.remove('input-focused');
      });

      // 即時驗證反饋
      if (input.type === 'tel') {
        this.setupPhoneValidation(input);
      }
      
      if (input.type === 'email') {
        this.setupEmailValidation(input);
      }
    });

    // 字符計數器
    const textareas = document.querySelectorAll('textarea[maxlength]');
    textareas.forEach(textarea => {
      this.setupCharacterCounter(textarea);
    });

    // 表單提交增強
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      this.setupFormSubmission(form);
    });
  };

  // 電話號碼驗證
  MobileEnhancements.setupPhoneValidation = function(input) {
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      const isValid = value.length >= 8 && value.length <= 15;
      
      e.target.classList.toggle('error', !isValid && value.length > 0);
      e.target.classList.toggle('success', isValid);
    });
  };

  // Email驗證
  MobileEnhancements.setupEmailValidation = function(input) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    input.addEventListener('blur', (e) => {
      const value = e.target.value.trim();
      const isValid = emailRegex.test(value);
      
      e.target.classList.toggle('error', !isValid && value.length > 0);
      e.target.classList.toggle('success', isValid);
    });
  };

  // 字符計數器
  MobileEnhancements.setupCharacterCounter = function(textarea) {
    const maxLength = parseInt(textarea.getAttribute('maxlength'));
    const counter = document.createElement('div');
    counter.className = 'character-counter';
    
    const updateCounter = () => {
      const current = textarea.value.length;
      const remaining = maxLength - current;
      counter.textContent = `${current}/${maxLength}`;
      
      counter.classList.toggle('warning', remaining <= 20);
      counter.classList.toggle('danger', remaining <= 5);
    };
    
    textarea.parentNode.appendChild(counter);
    textarea.addEventListener('input', updateCounter);
    updateCounter();
  };

  // 表單提交增強
  MobileEnhancements.setupFormSubmission = function(form) {
    form.addEventListener('submit', (e) => {
      const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
      
      if (submitBtn && !submitBtn.disabled) {
        // 防止重複提交
        submitBtn.disabled = true;
        submitBtn.classList.add('submitting');
        
        // 顯示載入狀態
        this.showLoadingState(submitBtn);
        
        // 5秒後重新啟用(防止卡住)
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.classList.remove('submitting');
          this.hideLoadingState();
        }, 5000);
      }
    });
  };

  // =================================================
  // 🛒 購物車增強功能
  // =================================================

  MobileEnhancements.setupCartEnhancements = function() {
    // 購物車按鈕增強
    const cartButton = document.querySelector('.cart-button');
    if (cartButton) {
      // 添加觸控回饋
      cartButton.addEventListener('touchstart', (e) => {
        cartButton.style.transform = 'scale(0.9)';
      }, { passive: true });
      
      cartButton.addEventListener('touchend', (e) => {
        cartButton.style.transform = '';
      }, { passive: true });
    }

    // 數量按鈕增強
    document.addEventListener('click', (e) => {
      if (e.target.matches('.quantity-btn')) {
        // 觸覺回饋
        if (navigator.vibrate) {
          navigator.vibrate(15);
        }
        
        // 視覺回饋
        e.target.style.transform = 'scale(0.9)';
        setTimeout(() => {
          e.target.style.transform = '';
        }, 100);
      }
    });

    // 購物車模態窗增強
    const cartModal = document.querySelector('.cart-modal-overlay');
    if (cartModal) {
      this.setupCartModalEnhancements(cartModal);
    }
  };

  // 購物車模態窗增強
  MobileEnhancements.setupCartModalEnhancements = function(cartModal) {
    // 防止背景滾動
    const preventBodyScroll = (e) => {
      if (cartModal.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    };

    // 監聽模態窗狀態變化
    const observer = new MutationObserver(() => {
      preventBodyScroll();
    });
    
    observer.observe(cartModal, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });

    // 滑動關閉購物車
    this.setupSwipeToClose(cartModal);
  };

  // 滑動關閉功能
  MobileEnhancements.setupSwipeToClose = function(modal) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    modal.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    modal.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      if (deltaY > 0) {
        const progress = Math.min(deltaY / 200, 1);
        modal.style.transform = `translateY(${deltaY * 0.5}px)`;
        modal.style.opacity = 1 - (progress * 0.3);
      }
    }, { passive: true });

    modal.addEventListener('touchend', () => {
      if (!isDragging) return;
      
      const deltaY = currentY - startY;
      isDragging = false;
      
      if (deltaY > 100) {
        // 關閉購物車
        const closeBtn = modal.querySelector('.cart-close');
        if (closeBtn) closeBtn.click();
      } else {
        // 回彈
        modal.style.transform = '';
        modal.style.opacity = '';
      }
    }, { passive: true });
  };

  // =================================================
  // ♿ 可訪問性增強
  // =================================================

  MobileEnhancements.setupAccessibility = function() {
    // 為觸控目標添加最小尺寸保證
    const touchTargets = document.querySelectorAll('button, [role="button"], input, a');
    touchTargets.forEach(target => {
      const rect = target.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        target.style.minWidth = '44px';
        target.style.minHeight = '44px';
        target.classList.add('size-enhanced');
      }
    });

    // 鍵盤導航增強
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation');
    });

    // 螢幕閱讀器支援
    this.setupScreenReaderSupport();
  };

  // 螢幕閱讀器支援
  MobileEnhancements.setupScreenReaderSupport = function() {
    // 為重要按鈕添加aria-label
    const cartButton = document.querySelector('.cart-button');
    if (cartButton && !cartButton.getAttribute('aria-label')) {
      cartButton.setAttribute('aria-label', '打開購物車');
    }

    // 為數量控制添加描述
    document.querySelectorAll('.quantity-btn').forEach(btn => {
      if (btn.textContent === '+' && !btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', '增加商品數量');
      }
      if (btn.textContent === '−' && !btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', '減少商品數量');
      }
    });

    // 為搜尋清除按鈕添加描述
    const searchClear = document.querySelector('.search-clear');
    if (searchClear && !searchClear.getAttribute('aria-label')) {
      searchClear.setAttribute('aria-label', '清除搜尋');
    }
  };

  // =================================================
  // ⚡ 性能優化
  // =================================================

  MobileEnhancements.setupPerformanceOptimizations = function() {
    // 圖片懶加載
    this.setupLazyLoading();
    
    // 防抖動優化
    this.setupDebouncing();
    
    // 記憶體優化
    this.setupMemoryOptimizations();
  };

  // 圖片懶加載
  MobileEnhancements.setupLazyLoading = function() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  };

  // 防抖動優化
  MobileEnhancements.setupDebouncing = function() {
    // 搜尋輸入防抖
    const searchInput = document.querySelector('#search-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          // 執行搜尋邏輯
          console.log('搜尋:', e.target.value);
        }, 300);
      });
    }

    // 滾動事件防抖
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // 滾動相關邏輯
      }, 10);
    }, { passive: true });
  };

  // 記憶體優化
  MobileEnhancements.setupMemoryOptimizations = function() {
    // 清理不必要的事件監聽器
    window.addEventListener('beforeunload', () => {
      // 清理邏輯
      console.log('🧹 清理行動端增強功能');
    });

    // 監控記憶體使用(開發模式)
    if (window.location.search.includes('debug=memory') && 'memory' in performance) {
      setInterval(() => {
        console.log('記憶體使用:', performance.memory.usedJSHeapSize / 1048576, 'MB');
      }, 5000);
    }
  };

  // =================================================
  // 🔄 載入狀態管理
  // =================================================

  MobileEnhancements.showLoadingState = function(button) {
    const originalText = button.textContent;
    button.dataset.originalText = originalText;
    button.textContent = '處理中...';
    
    // 創建載入覆蓋層
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">處理中，請稍候...</div>
    `;
    
    document.body.appendChild(overlay);
  };

  MobileEnhancements.hideLoadingState = function() {
    // 恢復按鈕文字
    const buttons = document.querySelectorAll('[data-original-text]');
    buttons.forEach(button => {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    });

    // 移除載入覆蓋層
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  };

  // =================================================
  // 🚀 初始化執行
  // =================================================

  // 初始化行動端增強功能
  MobileEnhancements.init();

  // 將對象暴露到全局範圍（用於調試）
  window.MobileEnhancements = MobileEnhancements;

  // 監控錯誤
  window.addEventListener('error', (e) => {
    console.error('行動端增強功能錯誤:', e.error);
  });

  // 性能監控
  if (window.location.search.includes('debug=perf')) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        if ('performance' in window) {
          console.log('頁面載入性能:', performance.timing);
        }
      }, 1000);
    });
  }

})();