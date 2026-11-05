import { useLayoutEffect, useRef, useState } from "react";

// 요소의 실제 너비 · 높이 측정 (카드 남는 높이에 맞춰 차트 크기를 정할 때 사용)
// 첫 값은 그리기 전에 바로 재고, 이후 크기 변화는 ResizeObserver 로 반영
export default function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) return undefined;

    function update() {
      const rect = element.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    }

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
