import { useEffect, useRef, useState, ReactNode } from "react";

interface ChartContainerProps {
  children: ReactNode;
  minHeight?: number;
}

/**
 * Wrapper that delays chart rendering until container has valid dimensions.
 * Prevents Recharts warnings about negative dimensions during initial render.
 */
export function ChartContainer({ children, minHeight = 200 }: ChartContainerProps) {
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if container has dimensions
    const checkDimensions = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setIsReady(true);
        return true;
      }
      return false;
    };

    // Try immediate check
    if (checkDimensions()) return;

    // Use ResizeObserver to wait for dimensions
    const observer = new ResizeObserver(() => {
      checkDimensions();
    });

    observer.observe(container);

    // Fallback timeout in case ResizeObserver doesn't fire
    const timeout = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: `${minHeight}px`,
      }}
    >
      {isReady ? children : null}
    </div>
  );
}
