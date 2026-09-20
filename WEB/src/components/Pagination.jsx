import "./Pagination.css";

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemLabel = "개"
}) {

  const maxVisiblePages = 5;
  
  let startPage = Math.max(
    1,
    currentPage - Math.floor(maxVisiblePages / 2)
  );

  let endPage = startPage + maxVisiblePages - 1;

  if (endPage > totalPages) {
    endPage = totalPages;

    startPage = Math.max(
      1,
      endPage - maxVisiblePages + 1
    );
  }

  const visiblePages = [];

  for (let page = startPage; page <= endPage; page++) {
    visiblePages.push(page);
  }
  
  return (
    <div className="pagination-container">

      {totalItems !== undefined && (
        <span className="pagination-total">
          총 {totalItems}{itemLabel}
        </span>
      )}

      <div className="pagination-buttons">

        {/* 첫 페이지 */}
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
        >
          ≪
        </button>

        {/* 이전 페이지 */}
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          ‹
        </button>


        {/* 페이지 번호 */}
        {visiblePages.map((page) => (
          <button
            type="button"
            key={page}
            className={
              currentPage === page
                ? "active"
                : ""
            }
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}


        {/* 다음 페이지 */}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          ›
        </button>

        {/* 마지막 페이지 */}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          ≫
        </button>

      </div>

    </div>
  );
}

export default Pagination;