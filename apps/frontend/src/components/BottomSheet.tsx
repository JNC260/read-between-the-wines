import { type ReactNode, type TouchEvent, useEffect, useRef, useState } from "react";

// How far down a drag has to go before letting go closes the sheet.
const CLOSE_AFTER_PX = 90;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// A panel that slides up from the bottom of a phone screen, over a dimmed
// page. Closes with the ✕, a tap outside it, Escape, or a drag down on the
// handle. While it's open the page behind doesn't scroll, and Tab stays
// inside it; closing hands focus back to whatever opened it.
const BottomSheet = ({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const panel = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) {
        return;
      }
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [onClose]);

  const onTouchStart = (e: TouchEvent) => {
    dragFrom.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (dragFrom.current !== null) {
      setDrag(Math.max(0, e.touches[0].clientY - dragFrom.current));
    }
  };
  const onTouchEnd = () => {
    if (drag > CLOSE_AFTER_PX) {
      onClose();
    }
    dragFrom.current = null;
    setDrag(0);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
      >
        <div
          className="sheet-handle"
          aria-hidden="true"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;
