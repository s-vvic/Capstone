import "./Charts.css";

// 가로 막대 순위 (카메라별 이벤트 순위 등)
// data: [{ key, label, sub, value }]
function RankBars({ data, unit = "건", onSelect }) {
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <ol className="rank-bars">
      {data.map((item, index) => (
        <li
          key={item.key}
          className={onSelect ? "clickable" : ""}
          onClick={() => onSelect?.(item)}
          title={`${item.label} ${item.value}${unit}`}
        >
          <span className="rank-number">{index + 1}</span>

          <div className="rank-body">
            <div className="rank-text">
              <span className="rank-label">
                {item.label}
                {item.sub && <small>{item.sub}</small>}
              </span>
              <strong>
                {item.value}
                {unit}
              </strong>
            </div>

            <div className="rank-track">
              <div
                className="rank-fill"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default RankBars;
