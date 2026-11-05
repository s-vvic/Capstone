import { useLayoutEffect, useRef, useState } from "react";

/*
  화면 높이에 맞춰 한 페이지 행 수를 정하는 페이지네이션
  - 표 안에 스크롤을 두지 않고, 남는 높이에 들어가는 만큼만 보여준 뒤 나머지는 다음 페이지로
  - 창 크기가 바뀌면 다시 계산하고, 보고 있던 첫 행이 들어 있는 페이지를 유지

  사용법
    const { areaRef, pageItems, page, setPage, totalPages, rowsPerPage } = useFitPagination(items);

    <div className="...-table-area" ref={areaRef}>   ← flex: 1; min-height: 0; (남는 높이를 채우는 영역)
      <div className="...-table-wrapper">           ← overflow: hidden; (높이는 내용만큼)
        <table> <thead>…</thead> <tbody>{pageItems.map(…)}</tbody> </table>
      </div>
    </div>
    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
*/
function useFitPagination(items, { fallbackRowHeight = 52, minRows = 1 } = {}) {
  const areaRef = useRef(null);
  const rowsRef = useRef(10);

  const [rowsPerPage, setRowsPerPage] = useState(rowsRef.current);
  const [page, setPage] = useState(1);

  // 최신 옵션으로 행 수를 다시 계산 (바뀐 경우에만 상태 갱신 → 반복 렌더 없음)
  const measureRef = useRef(() => {});

  measureRef.current = function measure() {
    const area = areaRef.current;
    const table = area?.querySelector("table");

    if (!table) {
      return;
    }

    const head = table.querySelector("thead");
    const rows = table.querySelectorAll("tbody tr");

    const tableHeight = table.getBoundingClientRect().height;
    const headHeight = head ? head.getBoundingClientRect().height : 0;

    // 표 바깥 상자(테두리 · 여백)가 차지하는 높이
    const wrapper = table.parentElement;
    const chromeHeight = wrapper && wrapper !== area
      ? wrapper.getBoundingClientRect().height - tableHeight
      : 0;

    // collapse 테두리까지 반영되도록 실제 행 높이 평균을 사용
    const rowHeight = rows.length > 0
      ? (tableHeight - headHeight) / rows.length
      : fallbackRowHeight;

    const available = area.clientHeight - headHeight - chromeHeight;
    // 소수점 반올림 차이로 한 줄이 빠지지 않도록 1px 여유
    const next = Math.max(minRows, Math.floor((available + 1) / rowHeight));

    if (next !== rowsRef.current) {
      const prev = rowsRef.current;
      rowsRef.current = next;

      setRowsPerPage(next);
      setPage((p) => Math.floor(((p - 1) * prev) / next) + 1);
    }
  };

  // 렌더마다 확인: 같은 화면 안에서 위 요소(일괄 처리 바 등)가 생기거나 없어져 높이가 바뀐 경우
  useLayoutEffect(() => {
    measureRef.current();
  });

  // 창 크기 변경처럼 렌더 없이 높이가 바뀌는 경우
  useLayoutEffect(() => {
    const area = areaRef.current;

    if (!area) {
      return undefined;
    }

    const observer = new ResizeObserver(() => measureRef.current());
    observer.observe(area);

    return () => observer.disconnect();
  }, []);

  const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));

  // 삭제 · 필터로 마지막 페이지가 비면 이전 페이지로
  const safePage = Math.min(page, totalPages);

  const startIndex = (safePage - 1) * rowsPerPage;

  const pageItems = items.slice(startIndex, startIndex + rowsPerPage);

  return {
    areaRef,
    pageItems,
    page: safePage,
    setPage,
    totalPages,
    rowsPerPage,
    startIndex,
  };
}

export default useFitPagination;
