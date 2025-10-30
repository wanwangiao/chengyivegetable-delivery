'use client';

import { useEffect, useState } from 'react';
import styles from './ProductDetailModal.module.css';
import { formatCurrency } from '../utils/currency';

interface ProductOption {
  id?: string;
  name: string;
  price: number | null;
  groupName?: string;
  isRequired?: boolean;
  selectionType?: 'single' | 'multiple';
  sortOrder?: number;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number | null | undefined;
  unit: string;
  stock: number;
  imageUrl?: string;
  description?: string;
  options?: ProductOption[];
}

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, selectedOptions?: Record<string, string | string[]>) => void;
}

export function ProductDetailModal({ product, open, onClose, onAddToCart }: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setQuantity(1);
      setSelectedOptions({});
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!product) return null;

  const isVariablePrice = product.price === null || product.price === undefined;
  const unitPrice = isVariablePrice ? 0 : product.price ?? 0;
  const totalPrice = unitPrice * quantity;

  // Group options by groupName
  const optionGroups = product.options && product.options.length > 0
    ? product.options.reduce((groups, option) => {
        const groupKey = option.groupName || '選項';
        if (!groups[groupKey]) {
          groups[groupKey] = {
            name: groupKey,
            isRequired: option.isRequired ?? false,
            selectionType: option.selectionType ?? 'single',
            options: []
          };
        }
        groups[groupKey].options.push(option);
        return groups;
      }, {} as Record<string, { name: string; isRequired: boolean; selectionType: 'single' | 'multiple'; options: ProductOption[] }>)
    : null;

  const hasOptions = optionGroups !== null;

  const handleAddToCart = () => {
    // 過濾掉空的選項（多選時可能是空陣列）
    const filteredOptions = Object.entries(selectedOptions).reduce((acc, [key, value]) => {
      if (Array.isArray(value) && value.length === 0) return acc;
      if (!value) return acc;
      acc[key] = value;
      return acc;
    }, {} as Record<string, string | string[]>);

    onAddToCart(product, quantity, Object.keys(filteredOptions).length > 0 ? filteredOptions : undefined);
    onClose();
  };

  const increaseQuantity = () => {
    if (quantity < product.stock) {
      setQuantity(prev => prev + 1);
    }
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`${styles.modal} ${open ? styles.modalOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <div className={`${styles.modalContent} ${open ? styles.modalSlideIn : ''}`}>
          <div className={styles.modalHeader}>
            <button className={styles.closeButton} onClick={onClose} aria-label="關閉">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className={styles.splitLayout}>
            {/* Left Column: Product Image */}
            <div className={styles.leftColumn}>
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className={styles.productImage} />
              ) : (
                <div className={styles.imagePlaceholder}>
                  <span className={styles.placeholderIcon}>🥬</span>
                </div>
              )}
            </div>

            {/* Right Column: Product Info */}
            <div className={styles.rightColumn}>
              <div className={styles.category}>{product.category}</div>
              <h2 id="product-modal-title" className={styles.title}>
                {product.name}
              </h2>

              {product.description && (
                <p className={styles.description}>{product.description}</p>
              )}

              <div className={styles.priceRow}>
                <div className={styles.priceLabel}>價格</div>
                <div className={styles.priceValue}>
                  {isVariablePrice ? (
                    '依秤重計價'
                  ) : (
                    <>
                      NT$ {formatCurrency(product.price, { fallback: '0' })} / {product.unit}
                    </>
                  )}
                </div>
              </div>

              {/* Product Options */}
              {hasOptions && optionGroups && Object.entries(optionGroups).map(([groupKey, group]) => (
                <div key={groupKey} className={styles.optionsSection}>
                  <div className={styles.optionsLabel}>
                    {group.name}
                    {group.isRequired && <span className={styles.requiredBadge}>必選</span>}
                    {!group.isRequired && <span className={styles.optionalBadge}>可選</span>}
                  </div>
                  {group.options.map((option) => {
                    const isSelected = group.selectionType === 'single'
                      ? selectedOptions[groupKey] === option.name
                      : Array.isArray(selectedOptions[groupKey]) &&
                        (selectedOptions[groupKey] as string[]).includes(option.name);

                    return (
                      <label
                        key={option.name}
                        className={`${styles.optionItem} ${isSelected ? styles.optionItemSelected : ''}`}
                      >
                        {group.selectionType === 'single' ? (
                          <input
                            type="radio"
                            name={`option-group-${groupKey}`}
                            value={option.name}
                            checked={selectedOptions[groupKey] === option.name}
                            onChange={(e) =>
                              setSelectedOptions({ ...selectedOptions, [groupKey]: e.target.value })
                            }
                            className={styles.optionRadio}
                          />
                        ) : (
                          <input
                            type="checkbox"
                            value={option.name}
                            checked={
                              Array.isArray(selectedOptions[groupKey]) &&
                              (selectedOptions[groupKey] as string[]).includes(option.name)
                            }
                            onChange={(e) => {
                              const currentSelections = Array.isArray(selectedOptions[groupKey])
                                ? (selectedOptions[groupKey] as string[])
                                : [];
                              const newSelections = e.target.checked
                                ? [...currentSelections, option.name]
                                : currentSelections.filter(s => s !== option.name);
                              setSelectedOptions({ ...selectedOptions, [groupKey]: newSelections });
                            }}
                            className={styles.optionCheckbox}
                          />
                        )}
                        <span className={styles.optionName}>{option.name}</span>
                        {option.price !== null && option.price !== 0 && (
                          <span className={styles.optionPrice}>+NT$ {formatCurrency(option.price, { fallback: '0' })}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ))}

              {/* Quantity Controls */}
              <div className={styles.quantitySection}>
                <div className={styles.quantityLabel}>數量</div>
                <div className={styles.quantityControls}>
                  <button
                    className={styles.quantityButton}
                    onClick={decreaseQuantity}
                    disabled={quantity <= 1}
                    aria-label="減少數量"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <div className={styles.quantityDisplay}>{quantity}</div>
                  <button
                    className={styles.quantityButton}
                    onClick={increaseQuantity}
                    disabled={quantity >= product.stock}
                    aria-label="增加數量"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M10 5v10M5 10h10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <div className={styles.totalSection}>
              <div className={styles.totalLabel}>小計</div>
              <div className={styles.totalPrice}>
                {isVariablePrice ? '依實際秤重結算' : `NT$ ${formatCurrency(totalPrice, { fallback: '0' })}`}
              </div>
            </div>
            <button
              className={styles.addToCartButton}
              onClick={handleAddToCart}
              disabled={quantity <= 0 || quantity > product.stock || isVariablePrice}
            >
              <span>加入購物車</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M7 18a2 2 0 100-4 2 2 0 000 4zM16 18a2 2 0 100-4 2 2 0 000 4zM1 1h3l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L19 6H5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
