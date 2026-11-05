import { useState } from "react";
import { SERIES_COLOR } from "./chartColors";
import useElementWidth from "./useElementWidth";
import "./Charts.css";

// 기간별 추이 라인 차트 (단일 계열)
// points: [{ label, value }]
function LineChart({ points, height = 220, unit = "건", color = SERIES_COLOR }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const [containerRef, width] = useElementWidth();
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...points.map((p) => p.value));
  const niceMax = Math.ceil(maxValue / 5) * 5;

  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const x = (i) => padding.left + i * stepX;
  const y = (v) => padding.top + innerHeight - (v / niceMax) * innerHeight;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
      : "";

  const ticks = [0, niceMax / 2, niceMax];

  // x축 라벨은 최대 8개만 표시
  const labelEvery = Math.ceil(points.length / 8);

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * width;

    const index = Math.round((relativeX - padding.left) / (stepX || 1));

    setHoverIndex(Math.min(points.length - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="line-chart" ref={containerRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="chart-svg"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="기간별 이벤트 발생 추이"
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

        <path d={areaPath} fill={color} opacity="0.08" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.label} x={x(i)} y={height - 8} className="chart-axis-text" textAnchor="middle">
              {p.label}
            </text>
          ) : null
        )}

        {hovered && (
          <g>
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={padding.top}
              y2={padding.top + innerHeight}
              className="chart-crosshair"
            />
            <circle
              cx={x(hoverIndex)}
              cy={y(hovered.value)}
              r="5"
              fill={color}
              stroke="var(--bg)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(x(hoverIndex) / width) * 100}%`,
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

export default LineChart;
