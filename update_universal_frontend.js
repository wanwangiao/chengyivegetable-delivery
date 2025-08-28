// ========================================
// 前台商品頁面 JavaScript 更新腳本
// 新增 MenuPapa 風格商品彈窗功能
// ========================================

// 🌟 新版商品彈窗功能 - 需要加入到 index_universal.ejs

// 1. 替換 openProductDetail 函數
const newOpenProductModal = `
    // 🎆 新版 MenuPapa 風格商品彈窗
    function openProductModal(productId) {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      const modal = document.getElementById('product-modal');
      const title = document.getElementById('product-modal-title');
      const body = document.getElementById('product-modal-body');
      
      title.textContent = product.name;
      
      // 解析商品選項
      let optionGroups = [];
      if (product.has_options && product.option_groups) {
        try {
          const parsed = typeof product.option_groups === 'string' ? 
                        JSON.parse(product.option_groups) : product.option_groups;
          optionGroups = parsed.groups || [];
        } catch (e) {
          console.warn('解析商品選項失敗:', e);
        }
      }
      
      body.innerHTML = \`
        <div style="text-align: center; padding: var(--spacing-lg);">
          <!-- 🖼️ 商品大圖 -->
          <div style="margin-bottom: var(--spacing-lg);">
            \${product.image_url && product.image_url.startsWith('/uploads/') ? 
              \`<img src="\${product.image_url}" style="width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 12px;" alt="\${product.name}">\` :
              \`<div style="font-size: 8rem; margin: var(--spacing-lg) 0;">\${product.image_url || '🥬'}</div>\`
            }
          </div>
          
          <!-- 📝 商品名稱 -->
          <h3 style="font-size: var(--font-size-xxl); font-weight: 700; margin-bottom: var(--spacing-md); color: var(--text-primary);">
            \${product.name}
          </h3>
          
          <!-- 📄 商品說明 -->
          <div style="text-align: left; margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: var(--surface-color); border-radius: 8px; color: var(--text-secondary); line-height: 1.6;">
            \${product.description || (
              product.is_priced_item ? '新鮮計價商品，秤重後確認價格' : '新鮮優質，精選品質保證'
            )}
          </div>
          
          <!-- 💰 價格資訊 -->
          <div style="margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: rgba(124, 179, 66, 0.1); border-radius: 8px;">
            <div style="font-size: var(--font-size-xxl); font-weight: 700; color: var(--accent-color);">
              \${product.is_priced_item ? \`時價 - $\${product.price}/\${product.unit}\` : \`$\${product.price} / \${product.unit || '份'}\`}
            </div>
            \${product.is_priced_item ? 
              '<div style="font-size: var(--font-size-small); color: var(--text-secondary); margin-top: var(--spacing-xs);">依重量計算，秤重後確認價格</div>' : ''
            }
          </div>
          
          <!-- ⚙️ 商品選項 -->
          <div id="product-options" style="text-align: left;">
            \${optionGroups.map(group => \`
              <div style="margin-bottom: var(--spacing-lg);">
                <h4 style="font-size: var(--font-size-large); font-weight: 600; margin-bottom: var(--spacing-md); color: var(--text-primary);">
                  \${group.required ? '*' : ''} \${group.group_name}
                </h4>
                <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-sm);">
                  \${group.options.map(option => \`
                    <button type="button" 
                            class="option-btn \${option.is_default ? 'selected' : ''}" 
                            data-group-id="\${group.group_id}"
                            data-option-id="\${option.option_id}"
                            data-price-modifier="\${option.price_modifier}"
                            data-group-type="\${group.group_type}"
                            onclick="selectOption(this)"
                            style="padding: var(--spacing-sm) var(--spacing-md); 
                                   border: 2px solid var(--border-color); 
                                   border-radius: 25px; 
                                   background: \${option.is_default ? 'var(--accent-color)' : 'white'}; 
                                   color: \${option.is_default ? 'white' : 'var(--text-primary)'}; 
                                   cursor: pointer; 
                                   transition: all 0.2s ease;
                                   font-weight: 500;">
                      \${option.name}\${option.price_modifier > 0 ? \` +$\${option.price_modifier}\` : ''}
                    </button>
                  \`).join('')}
                </div>
              </div>
            \`).join('')}
          </div>
          
          <!-- 📝 備註 -->
          <div style="text-align: left; margin-bottom: var(--spacing-lg);">
            <h4 style="font-size: var(--font-size-large); font-weight: 600; margin-bottom: var(--spacing-sm); color: var(--text-primary);">
              備註
            </h4>
            <textarea id="product-note" 
                      placeholder="在此輸入文字" 
                      style="width: 100%; min-height: 80px; padding: var(--spacing-md); 
                             border: 2px solid var(--border-color); border-radius: 8px; 
                             font-family: inherit; resize: vertical;"></textarea>
          </div>
          
          <!-- 🛒 購買控制 -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md);">
            <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
              <button onclick="adjustModalQuantity(-1)" 
                      class="btn btn-secondary" 
                      style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">−</button>
              <div id="modal-quantity" 
                   style="font-size: var(--font-size-xl); font-weight: 700; min-width: 40px; text-align: center;">1</div>
              <button onclick="adjustModalQuantity(1)" 
                      class="btn btn-secondary" 
                      style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">+</button>
            </div>
            
            <button onclick="addToCartFromModal(\${productId})" 
                    class="btn btn-primary" 
                    style="flex: 1; padding: var(--spacing-md); font-size: var(--font-size-large); font-weight: 700;">
              <span id="modal-total-price">$\${product.price || 0}</span> 訂購
            </button>
          </div>
        </div>
      \`;
      
      // 初始化彈窗
      window.currentModalProduct = product;
      window.modalQuantity = 1;
      window.selectedOptions = {};
      updateModalPrice();
      
      showModal(modal);
      announceToScreenReader('已開啟 ' + product.name + ' 詳情');
    }
    
    // 相容性別名
    function openProductDetail(productId) {
      openProductModal(productId);
    }
`;

// 2. 新增選項選擇功能
const optionSelectionFunctions = `
    // 🎯 選項選擇功能
    function selectOption(button) {
      const groupId = button.dataset.groupId;
      const optionId = button.dataset.optionId;
      const groupType = button.dataset.groupType;
      const priceModifier = parseFloat(button.dataset.priceModifier) || 0;
      
      if (groupType === 'single') {
        // 單選：清除同組其他選項
        document.querySelectorAll(\`[data-group-id="\${groupId}"]\`).forEach(btn => {
          btn.classList.remove('selected');
          btn.style.background = 'white';
          btn.style.color = 'var(--text-primary)';
        });
        
        // 選中當前選項
        button.classList.add('selected');
        button.style.background = 'var(--accent-color)';
        button.style.color = 'white';
        
        window.selectedOptions[groupId] = {
          optionId: optionId,
          priceModifier: priceModifier,
          name: button.textContent.trim()
        };
      } else {
        // 多選：切換狀態
        if (button.classList.contains('selected')) {
          button.classList.remove('selected');
          button.style.background = 'white';
          button.style.color = 'var(--text-primary)';
          delete window.selectedOptions[groupId + '_' + optionId];
        } else {
          button.classList.add('selected');
          button.style.background = 'var(--accent-color)';
          button.style.color = 'white';
          window.selectedOptions[groupId + '_' + optionId] = {
            optionId: optionId,
            priceModifier: priceModifier,
            name: button.textContent.trim()
          };
        }
      }
      
      updateModalPrice();
    }
    
    // 📊 更新彈窗價格
    function updateModalPrice() {
      if (!window.currentModalProduct) return;
      
      let basePrice = parseFloat(window.currentModalProduct.price) || 0;
      let optionPrice = 0;
      
      // 計算選項加價
      Object.values(window.selectedOptions || {}).forEach(option => {
        optionPrice += option.priceModifier;
      });
      
      let totalPrice = (basePrice + optionPrice) * (window.modalQuantity || 1);
      
      const priceElement = document.getElementById('modal-total-price');
      if (priceElement) {
        if (window.currentModalProduct.is_priced_item) {
          priceElement.textContent = '時價';
        } else {
          priceElement.textContent = '$' + totalPrice;
        }
      }
    }
    
    // 🔢 調整彈窗數量
    function adjustModalQuantity(change) {
      window.modalQuantity = Math.max(1, (window.modalQuantity || 1) + change);
      const quantityElement = document.getElementById('modal-quantity');
      if (quantityElement) {
        quantityElement.textContent = window.modalQuantity;
      }
      updateModalPrice();
      announceToScreenReader('數量已調整為 ' + window.modalQuantity);
    }
`;

// 3. 新版購物車功能
const newCartFunctions = `
    // 🛒 從彈窗加入購物車
    function addToCartFromModal(productId) {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      // 建立購物車項目
      const cartItem = {
        productId: product.id,
        name: product.name,
        basePrice: product.price,
        quantity: window.modalQuantity || 1,
        unit: product.unit,
        is_priced_item: product.is_priced_item,
        selectedOptions: { ...window.selectedOptions },
        note: document.getElementById('product-note')?.value || '',
        image: product.image_url
      };
      
      // 計算總價
      let optionPrice = 0;
      Object.values(cartItem.selectedOptions).forEach(option => {
        optionPrice += option.priceModifier;
      });
      cartItem.totalPrice = (cartItem.basePrice + optionPrice) * cartItem.quantity;
      
      // 加入購物車
      cart.push(cartItem);
      localStorage.setItem('universalCart', JSON.stringify(cart));
      updateCartDisplay();
      
      closeProductDetail();
      showFeedback('已加入 ' + cartItem.name + ' 到購物車', 'success');
      announceToScreenReader('已加入 ' + cartItem.name + ' 到購物車');
    }
    
    // 更新 closeProductDetail 函數
    function closeProductDetail() {
      const modal = document.getElementById('product-modal');
      hideModal(modal);
      
      // 清除彈窗狀態
      window.currentModalProduct = null;
      window.modalQuantity = 1;
      window.selectedOptions = {};
      
      announceToScreenReader('已關閉商品詳情');
    }
`;

// 4. CSS 樣式更新
const newCSS = `
/* 商品列表樣式 - 左圖右文佈局 */
.products-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: 800px;
  margin: 0 auto;
}

.product-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: white;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
}

.product-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(124, 179, 66, 0.2);
  border-color: var(--accent-color);
}

.product-image-left {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.product-image-left img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.product-image-left .product-emoji {
  font-size: 3rem;
}

.product-info-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.product-price-info {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
}

.product-price-info .product-price {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--accent-color);
}

.product-price-info .product-unit {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
}

.product-description {
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 選項按鈕樣式 */
.option-btn:hover {
  transform: scale(1.05);
  border-color: var(--accent-color) !important;
}

.option-btn.selected {
  background: var(--accent-color) !important;
  color: white !important;
  border-color: var(--accent-color) !important;
}

/* 響應式設計 */
@media (max-width: 600px) {
  .product-item {
    flex-direction: column;
    text-align: center;
  }
  
  .product-image-left {
    width: 100%;
    height: 150px;
  }
  
  .product-info-right {
    text-align: center;
  }
}
`;

console.log('='.repeat(50));
console.log('前台商品頁面更新腳本已生成');
console.log('='.repeat(50));
console.log('1. 新版商品彈窗功能 (MenuPapa風格)');
console.log('2. 商品選項選擇系統');
console.log('3. 價格計算功能');
console.log('4. 購物車整合');
console.log('5. CSS樣式更新');
console.log('='.repeat(50));