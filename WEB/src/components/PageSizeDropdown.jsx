import { useEffect, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";

function PageSizeDropDown({ value, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const options = [10, 20, 30, 50];

    useEffect(() => {
        function handleClickOutside(e) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);

    function handleSelect(option) {
        onChange(option);
        setIsOpen(false);
    }

    return(
        <div
            className="event-page-size-dropdown"
            ref = {dropdownRef}
        >
            <button
                type="button"
                className={`page-size-button ${isOpen ? "open" : ""}`}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span>{value}개씩 보기</span>

                <FiChevronDown
                    className={`page-siz-arrow ${isOpen ? "open" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="page-size-menu">
                    {options.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={
                                value === option
                                    ? "page-size-option selected"
                                    : "page-size-option"
                            }
                        >
                            {option}개씩 보기
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default PageSizeDropDown;

