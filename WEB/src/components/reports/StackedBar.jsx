import "./StackedBar.css";

// 상태 요약 누적 막대 (라벨 + 수치 함께 표시)
// items: [{ key, label, value, color }]
function StackedBar({ items, unit = "대", showLegend = true, compact = false }) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <div className={`stacked-bar ${compact ? "compact" : ""}`.trim()}>
      <div className="stacked-track">
        {items.map((item) =>
          item.value > 0 ? (
            <div
              key={item.key}
              className="stacked-segment"
              style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }}
              title={`${item.label} ${item.value}${unit}`}
            />
          ) : null
        )}
      </div>

      {showLegend && (
        <ul className="stacked-legend">
          {items.map((item) => (
            <li key={item.key}>
              <span className="legend-swatch" style={{ backgroundColor: item.color }} />
              {item.label}
              <strong>
                {item.value}
                {unit}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default StackedBar;
