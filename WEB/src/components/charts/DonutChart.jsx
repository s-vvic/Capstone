import { useState } from "react";
import "./Charts.css";

// 도넛 차트
// data: [{ key, label, value, color }]
function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerValue,
  centerLabel,
  unit = "건",
}) {
  const [hoverKey, setHoverKey] = useState(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  // hover 시 두께가 늘어나는 만큼 여백을 남겨 영역 밖으로 잘리지 않게
  const hoverGrow = 4;
  const radius = (size - thickness - hoverGrow) / 2;
  const circumference = 2 * Math.PI * radius;

  // 조각 사이 2px 간격
  const gap = data.filter((item) => item.value > 0).length > 1 ? 2 : 0;

  let offset = 0;

  const segments = data.map((item) => {
    const length = total === 0 ? 0 : (item.value / total) * circumference;

    const segment = {
      ...item,
      dash: Math.max(0, length - gap),
      offset,
      percent: total === 0 ? 0 : (item.value / total) * 100,
    };

    offset += length;

    return segment;
  });

  const hovered = segments.find((item) => item.key === hoverKey);

  return (
    <div className="donut-chart">
      <div className="donut-figure" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={data
            .map((item) => `${item.label} ${item.value}${unit}`)
            .join(", ")}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={thickness}
          />

          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {segments.map((item) =>
              item.value > 0 ? (
                <circle
                  key={item.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={hoverKey === item.key ? thickness + hoverGrow : thickness}
                  strokeDasharray={`${item.dash} ${circumference}`}
                  strokeDashoffset={-item.offset}
                  opacity={hoverKey && hoverKey !== item.key ? 0.4 : 1}
                  className="donut-segment"
                  onMouseEnter={() => setHoverKey(item.key)}
                  onMouseLeave={() => setHoverKey(null)}
                />
              ) : null
            )}
          </g>
        </svg>

        <div className="donut-center">
          {hovered ? (
            <>
              <strong>{hovered.percent.toFixed(1)}%</strong>
              <span>{hovered.label}</span>
            </>
          ) : (
            <>
              <strong>{centerValue ?? total}</strong>
              <span>{centerLabel}</span>
            </>
          )}
        </div>
      </div>

      <ul className="chart-legend">
        {segments.map((item) => (
          <li
            key={item.key}
            className={hoverKey === item.key ? "active" : ""}
            onMouseEnter={() => setHoverKey(item.key)}
            onMouseLeave={() => setHoverKey(null)}
          >
            <span
              className="legend-swatch"
              style={{ backgroundColor: item.color }}
            />
            <span className="legend-label">{item.label}</span>
            <span className="legend-value">
              {item.value}
              {unit}
              <small>{item.percent.toFixed(1)}%</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DonutChart;
