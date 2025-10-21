'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './FadeIn.module.css';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number; // 延遲時間（毫秒）
  duration?: number; // 動畫持續時間（毫秒）
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'; // 滑入方向
  threshold?: number; // 可見度閾值 (0-1)
  once?: boolean; // 是否只執行一次
  className?: string;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 600,
  direction = 'up',
  threshold = 0.1,
  once = true,
  className = ''
}: FadeInProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            setHasAnimated(true);
          }
        } else if (!once && !hasAnimated) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin: '0px'
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, once, hasAnimated]);

  const animationClass = direction !== 'none' ? styles[`slide${direction.charAt(0).toUpperCase()}${direction.slice(1)}`] : '';

  return (
    <div
      ref={elementRef}
      className={`
        ${styles.fadeIn}
        ${isVisible ? styles.visible : ''}
        ${animationClass}
        ${className}
      `}
      style={{
        '--fade-delay': `${delay}ms`,
        '--fade-duration': `${duration}ms`
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
