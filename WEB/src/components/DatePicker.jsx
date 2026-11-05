// 화면 톤에 맞춘 날짜 선택 (브라우저 기본 date input 대체)
// value / onChange 는 "YYYY-MM-DD" 문자열 (선택 안 함 = "")
import { useState } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useClick,
  useDismiss,
  useInteractions,
} from "@floating-ui/react";

import "./DatePicker.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (value) => String(value).padStart(2, "0");

function toValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromValue(value) {
  if (!value) {
    return null;
  }

  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function DatePicker({
  value = "",
  onChange,
  min,
  max,
  placeholder = "날짜 선택",
  active = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selected = fromValue(value);
  const minDate = fromValue(min);
  const maxDate = fromValue(max);
  const today = new Date();

  // 달력에 보이는 달 (열 때마다 선택한 날짜 또는 오늘 기준)
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (open) {
        const base = fromValue(value) ?? new Date();
        setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
      }
      setIsOpen(open);
    },
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 10 })],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  // 6주 x 7일 칸
  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(1 - firstDay.getDay());

  const days = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return date;
  });

  const isNextDisabled =
    maxDate &&
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1) > maxDate;

  const isPrevDisabled =
    minDate &&
    new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1) <= minDate;

  function moveMonth(diff) {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + diff, 1)
    );
  }

  function handleSelect(date) {
    onChange?.(toValue(date));
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        className={[
          "date-picker-button",
          isOpen || active ? "active" : "",
          className,
        ].join(" ").trim()}
        {...getReferenceProps()}
      >
        <FiCalendar />
        <span className={value ? "" : "date-picker-placeholder"}>
          {value ? value.replaceAll("-", ".") : placeholder}
        </span>
      </button>

      {isOpen && (
        <div
          ref={refs.setFloating}
          className="date-picker-popover"
          style={floatingStyles}
          {...getFloatingProps()}
        >
          <div className="date-picker-header">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              disabled={isPrevDisabled}
              aria-label="이전 달"
            >
              <FiChevronLeft />
            </button>

            <strong>
              {viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월
            </strong>

            <button
              type="button"
              onClick={() => moveMonth(1)}
              disabled={isNextDisabled}
              aria-label="다음 달"
            >
              <FiChevronRight />
            </button>
          </div>

          <div className="date-picker-grid">
            {WEEKDAYS.map((day, i) => (
              <span
                key={day}
                className={`date-picker-weekday ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`.trim()}
              >
                {day}
              </span>
            ))}

            {days.map((date) => {
              const dateValue = toValue(date);
              const isOtherMonth = date.getMonth() !== viewMonth.getMonth();
              const isDisabled =
                (maxDate && date > maxDate) || (minDate && date < minDate);

              return (
                <button
                  type="button"
                  key={dateValue}
                  className={[
                    "date-picker-day",
                    isOtherMonth ? "other-month" : "",
                    dateValue === toValue(today) ? "today" : "",
                    dateValue === value ? "selected" : "",
                  ].join(" ").trim()}
                  disabled={isDisabled}
                  onClick={() => handleSelect(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="date-picker-footer">
            <button
              type="button"
              onClick={() => {
                onChange?.("");
                setIsOpen(false);
              }}
            >
              지우기
            </button>

            <button
              type="button"
              onClick={() => handleSelect(today)}
              disabled={(max && toValue(today) > max) || (min && toValue(today) < min)}
            >
              오늘
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default DatePicker;
