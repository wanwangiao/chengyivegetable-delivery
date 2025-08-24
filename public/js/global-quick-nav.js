/**
 * 全局快捷導航系統
 * 為所有管理頁面提供統一的快捷導航功能
 */

class GlobalQuickNav {
    constructor() {
        this.isVisible = false;
        this.navigationItems = [
            { icon: 'fas fa-tachometer-alt', text: '後台首頁', url: '/admin', shortcut: 'Ctrl+1' },
            { icon: 'fas fa-shopping-cart', text: '訂單管理', url: '/admin/orders', shortcut: 'Ctrl+2' },
            { icon: 'fas fa-box', text: '商品管理', url: '/admin/products', shortcut: 'Ctrl+3' },
            { icon: 'fas fa-warehouse', text: '庫存管理', url: '/admin/inventory', shortcut: 'Ctrl+4' },
            { icon: 'fas fa-chart-bar', text: '統計報表', url: '/admin/reports', shortcut: 'Ctrl+5' },
            { icon: 'fas fa-truck', text: '智能配送', url: '/admin/delivery', shortcut: 'Ctrl+6', badge: true },
            { icon: 'fas fa-route', text: '路線優化', url: '/admin/route-optimization', shortcut: 'Ctrl+7' },
            { icon: 'fas fa-map', text: '配送地圖', url: '/admin/map', shortcut: 'Ctrl+8' },
            { icon: 'fas fa-cog', text: '系統設定', url: '/admin/site-settings', shortcut: 'Ctrl+9' }
        ];
        this.init();
    }

    init() {
        this.createNavigation();
        this.bindEvents();
        this.checkCurrentPage();
    }

    createNavigation() {
        // 創建主容器
        const quickNavContainer = document.createElement('div');
        quickNavContainer.className = 'global-quick-nav';
        quickNavContainer.innerHTML = `
            <button class="quick-nav-toggle" id="globalQuickNavToggle" title="快捷導航 (Alt+N)">
                <i class="fas fa-bars"></i>
            </button>
            <div class="quick-nav-menu" id="globalQuickNavMenu">
                <div class="quick-nav-header">
                    <h6><i class="fas fa-rocket"></i> 快捷導航</h6>
                    <small class="text-muted">按 Alt+N 快速開啟</small>
                </div>
                <div class="quick-nav-items">
                    ${this.navigationItems.map(item => this.createNavItem(item)).join('')}
                </div>
                <div class="quick-nav-footer">
                    <div class="d-flex justify-content-between">
                        <small class="text-muted">支援鍵盤快捷鍵</small>
                        <button class="btn btn-sm btn-outline-secondary" onclick="globalQuickNav.showShortcuts()">
                            <i class="fas fa-keyboard"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加到頁面
        document.body.appendChild(quickNavContainer);
    }

    createNavItem(item) {
        const currentPath = window.location.pathname;
        const isActive = currentPath === item.url;
        const badgeHTML = item.badge ? '<span class="nav-badge">NEW</span>' : '';
        
        return `
            <a href="${item.url}" class="quick-nav-item ${isActive ? 'active' : ''}" 
               title="${item.text} (${item.shortcut})">
                <div class="nav-icon">
                    <i class="${item.icon}"></i>
                    ${badgeHTML}
                </div>
                <div class="nav-content">
                    <span class="nav-text">${item.text}</span>
                    <small class="nav-shortcut">${item.shortcut}</small>
                </div>
            </a>
        `;
    }

    bindEvents() {
        // 切換導航顯示
        const toggle = document.getElementById('globalQuickNavToggle');
        const menu = document.getElementById('globalQuickNavMenu');
        
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleNavigation();
        });

        // 點擊外部關閉
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.global-quick-nav')) {
                this.hideNavigation();
            }
        });

        // 鍵盤快捷鍵
        document.addEventListener('keydown', (e) => {
            // Alt+N 開啟快捷導航
            if (e.altKey && e.key === 'n') {
                e.preventDefault();
                this.toggleNavigation();
                return;
            }

            // Ctrl+數字 快捷導航
            if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                if (this.navigationItems[index]) {
                    window.location.href = this.navigationItems[index].url;
                }
                return;
            }

            // ESC 關閉導航
            if (e.key === 'Escape' && this.isVisible) {
                this.hideNavigation();
            }
        });

        // 懸停效果
        const navItems = document.querySelectorAll('.quick-nav-item');
        navItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.transform = 'translateX(5px)';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.transform = 'translateX(0)';
            });
        });
    }

    toggleNavigation() {
        if (this.isVisible) {
            this.hideNavigation();
        } else {
            this.showNavigation();
        }
    }

    showNavigation() {
        const menu = document.getElementById('globalQuickNavMenu');
        const toggle = document.getElementById('globalQuickNavToggle');
        
        menu.classList.add('show');
        toggle.classList.add('active');
        toggle.querySelector('i').className = 'fas fa-times';
        
        this.isVisible = true;
        
        // 添加顯示動畫
        menu.style.animation = 'quickNavSlideIn 0.3s ease-out';
    }

    hideNavigation() {
        const menu = document.getElementById('globalQuickNavMenu');
        const toggle = document.getElementById('globalQuickNavToggle');
        
        menu.classList.remove('show');
        toggle.classList.remove('active');
        toggle.querySelector('i').className = 'fas fa-bars';
        
        this.isVisible = false;
    }

    checkCurrentPage() {
        // 檢查當前頁面並更新導航狀態
        const currentPath = window.location.pathname;
        const currentItem = this.navigationItems.find(item => item.url === currentPath);
        
        if (currentItem) {
            const toggle = document.getElementById('globalQuickNavToggle');
            toggle.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
            toggle.title = `當前頁面: ${currentItem.text} - ${currentItem.shortcut}`;
        }
    }

    showShortcuts() {
        const shortcutsModal = `
            <div class="shortcuts-modal" id="shortcutsModal">
                <div class="shortcuts-content">
                    <div class="shortcuts-header">
                        <h5><i class="fas fa-keyboard"></i> 鍵盤快捷鍵</h5>
                        <button class="btn-close" onclick="globalQuickNav.hideShortcuts()">×</button>
                    </div>
                    <div class="shortcuts-body">
                        <div class="row">
                            <div class="col-6">
                                <h6>導航快捷鍵</h6>
                                ${this.navigationItems.map(item => 
                                    `<div class="shortcut-item">
                                        <kbd>${item.shortcut}</kbd>
                                        <span>${item.text}</span>
                                    </div>`
                                ).join('')}
                            </div>
                            <div class="col-6">
                                <h6>系統快捷鍵</h6>
                                <div class="shortcut-item">
                                    <kbd>Alt+N</kbd>
                                    <span>開啟/關閉快捷導航</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>Esc</kbd>
                                    <span>關閉當前對話框</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>F5</kbd>
                                    <span>重新整理頁面</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', shortcutsModal);
    }

    hideShortcuts() {
        const modal = document.getElementById('shortcutsModal');
        if (modal) {
            modal.remove();
        }
    }

    // 公共方法：更新未讀數量
    updateBadge(pageUrl, count) {
        const item = document.querySelector(`[href="${pageUrl}"] .nav-badge`);
        if (item) {
            item.textContent = count > 99 ? '99+' : count.toString();
            item.style.display = count > 0 ? 'block' : 'none';
        }
    }

    // 公共方法：添加通知點
    addNotification(pageUrl) {
        const item = document.querySelector(`[href="${pageUrl}"]`);
        if (item && !item.querySelector('.notification-dot')) {
            const dot = document.createElement('span');
            dot.className = 'notification-dot';
            item.querySelector('.nav-icon').appendChild(dot);
        }
    }

    // 公共方法：移除通知點
    removeNotification(pageUrl) {
        const dot = document.querySelector(`[href="${pageUrl}"] .notification-dot`);
        if (dot) {
            dot.remove();
        }
    }
}

// 自動初始化
let globalQuickNav;

document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否為管理頁面
    if (window.location.pathname.startsWith('/admin')) {
        globalQuickNav = new GlobalQuickNav();
        
        // 全局可用
        window.globalQuickNav = globalQuickNav;
        
        console.log('🚀 全局快捷導航系統已啟動');
    }
});

// 鍵盤動畫樣式
const quickNavStyles = `
    @keyframes quickNavSlideIn {
        from {
            opacity: 0;
            transform: translateY(20px) scale(0.9);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    
    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.4);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(40, 167, 69, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(40, 167, 69, 0);
        }
    }
`;

// 動態添加樣式
if (window.location.pathname.startsWith('/admin')) {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = quickNavStyles;
    document.head.appendChild(styleSheet);
}