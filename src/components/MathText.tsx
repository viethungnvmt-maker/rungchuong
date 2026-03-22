import { useEffect, useRef } from 'react';

declare global {
  interface Window { MathJax: any; }
}

interface MathTextProps {
  text: string;
  className?: string;
  tag?: 'span' | 'div' | 'h2' | 'h3' | 'p';
  mathScale?: number;
}

/**
 * MathText – render text + công thức MathJax, không vỡ layout.
 *
 * FIX: Đồng nhất kích thước công thức giữa ngân hàng câu hỏi và màn hình trò chơi.
 * - Luôn convert display math → inline math
 * - Ép mjx-container hiển thị inline, font-size kế thừa từ parent
 * - Giới hạn kích thước SVG trong container
 */
export default function MathText({
  text,
  className = '',
  tag: Tag = 'span',
  mathScale = 1,
}: MathTextProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let isMounted = true;
    let attempts = 0;

    /**
     * Convert tất cả display math → inline math để tránh render quá to.
     * $$...$$ → \(...\)
     * \[...\] → \(...\)
     */
    const toInline = (raw: string): string => {
      // $$...$$ → \(...\)  (inline math)
      let result = raw.replace(/\$\$([^$]+?)\$\$/gs, '\\($1\\)');
      // \[...\] → \(...\)
      result = result.replace(/\\\[(.+?)\\\]/gs, '\\($1\\)');
      return result;
    };

    const applyContainerStyles = (el: HTMLElement) => {
      el.querySelectorAll('mjx-container').forEach((node) => {
        const c = node as HTMLElement;
        // Ép inline-flex để không chiếm full width
        c.style.display = 'inline-flex';
        c.style.alignItems = 'center';
        c.style.verticalAlign = 'middle';
        c.style.maxWidth = '100%';
        c.style.margin = '0 2px';
        c.style.fontSize = 'inherit';
        // Xóa attribute display="true" nếu có (do display math)
        c.removeAttribute('display');

        const svg = c.querySelector('svg') as SVGSVGElement | null;
        if (svg) {
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
          svg.style.overflow = 'visible';
          if (mathScale !== 1) {
            svg.style.transform = `scale(${mathScale})`;
            svg.style.transformOrigin = 'left center';
          }
        }
      });
    };

    const tryRender = async () => {
      if (!isMounted || !ref.current) return;

      if (window.MathJax?.typesetPromise) {
        try {
          const inlineText = toInline(text);
          ref.current.innerHTML = inlineText;
          window.MathJax.typesetClear?.([ref.current]);
          await window.MathJax.typesetPromise([ref.current]);
          if (isMounted && ref.current) {
            applyContainerStyles(ref.current);
          }
        } catch (err) {
          console.warn('[MathJax] render error:', err);
          if (isMounted && ref.current) ref.current.innerHTML = text;
        }
      } else if (attempts < 30) {
        attempts++;
        if (isMounted && ref.current) ref.current.innerHTML = toInline(text);
        setTimeout(tryRender, 200);
      }
    };

    tryRender();
    return () => { isMounted = false; };
  }, [text, mathScale]);

  return (
    <Tag
      ref={ref as any}
      className={className}
      style={{
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        minWidth: 0,
        lineHeight: 1.7,
        overflow: 'hidden',
      }}
    />
  );
}
