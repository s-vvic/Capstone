import { useEffect, useRef, useState } from "react";

// 요소의 실제 너비 측정 (SVG 텍스트가 늘어나지 않도록 viewBox를 실제 크기로 맞춤)
export default function useElementWidth(defaultWidth = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    if (!ref.current) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
