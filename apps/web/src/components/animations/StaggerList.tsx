'use client';

import { Children, cloneElement, isValidElement } from 'react';
import { FadeIn } from './FadeIn';

interface StaggerListProps {
  children: React.ReactNode;
  staggerDelay?: number; // 每個項目之間的延遲（毫秒）
  initialDelay?: number; // 初始延遲（毫秒）
  duration?: number; // 動畫持續時間（毫秒）
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

export function StaggerList({
  children,
  staggerDelay = 100,
  initialDelay = 0,
  duration = 600,
  direction = 'up',
  className = ''
}: StaggerListProps) {
  const childArray = Children.toArray(children);

  return (
    <div className={className}>
      {childArray.map((child, index) => (
        <FadeIn
          key={index}
          delay={initialDelay + index * staggerDelay}
          duration={duration}
          direction={direction}
        >
          {child}
        </FadeIn>
      ))}
    </div>
  );
}
