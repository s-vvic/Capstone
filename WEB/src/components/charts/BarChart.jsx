import { useState } from "react";
import { SERIES_COLOR } from "./chartColors";
import useElementWidth from "./useElementWidth";
import "./Charts.css";

// 세로 막대 차트 (시간대별 통계 등, 단일 계열)
// data: [{ label, value }]
function BarChart({ data, height = 200, unit = "건", color = SERIES_COLOR, labelEvery = 1 }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const [containerRef, width] = useElementWidth();
  const padding = { top: 16, right: 8, bottom: 28, left: 36 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(maxValue / 5) * 5;

  const slot = innerWidth / Math.max(1, data.length);
  const barWidth = Math.max(4, slot - 4); // 막대 사이 간격

  const y = (v) => padding.top + innerHeight - (v / niceMax) * innerHeight;

  const ticks = [0, niceMax / 2, niceMax];

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="bar-chart" ref={containerRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="chart-svg"
        style={{ height }}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="막대 차트"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              className="chart-grid"
            />
            <text x={padding.left - 8} y={y(tick) + 4} className="chart-axis-text" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const barX = padding.left + i * slot + (slot - barWidth) / 2;
          const barHeight = Math.max(0, y(0) - y(d.value));

          return (
            <g key={d.label}>
              {/* 막대보다 넓은 hover 영역 */}
              <rect
                x={padding.left + i * slot}
                y={padding.top}
                width={slot}
                height={innerHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
              />
              <rect
                x={barX}
                y={y(d.value)}
                width={barWidth}
                height={barHeight}
                rx={Math.min(4, barWidth / 2)}
                fill={color}
                opacity={hoverIndex !== null && hoverIndex !== i ? 0.45 : 0.9}
                pointerEvents="none"
              />
              {i % labelEvery === 0 && (
                <text
                  x={padding.left + i * slot + slot / 2}
                  y={height - 8}
                  className="chart-axis-text"
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="chart-tooltip"
          style={{
            left: `${((padding.left + hoverIndex * slot + slot / 2) / width) * 100}%`,
          }}
        >
          <span>{hovered.label}</span>
          <strong>
            {hovered.value}
            {unit}
          </strong>
        </div>
      )}
    </div>
  );
}

export default BarChart;
