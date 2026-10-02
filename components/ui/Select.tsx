"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  value: string;
  options: SelectOption[] | string[];
  onChange: (value: string) => void;
  "aria-label"?: string;
  className?: string;
};

function normalize(options: SelectOption[] | string[]): SelectOption[] {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
}

type MenuPos = { top: number; left: number; width: number; maxHeight: number };

export function Select({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const items = normalize(options);
  const selected = items.find((o) => o.value === value) ?? items[0];

  function updatePos() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - r.bottom - gap - 12;
    const spaceAbove = r.top - gap - 12;
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(260, Math.max(120, preferBelow ? spaceBelow : spaceAbove));
    setPos({
      top: preferBelow ? r.bottom + gap : Math.max(12, r.top - gap - maxHeight),
      left: r.left,
      width: r.width,
      maxHeight,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePos();
    function onReposition() {
      updatePos();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <ul
            id={listId}
            className="select-menu select-menu--portal"
            role="listbox"
            tabIndex={-1}
            ref={menuRef}
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
            }}
          >
            {items.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={active ? "select-option is-active" : "select-option"}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <span>{o.label}</span>
                    {active ? <span className="select-check">✓</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div
      className={`select-wrap custom-select ${open ? "is-open" : ""} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        type="button"
        className="select select-trigger"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="select-trigger-label">{selected?.label}</span>
        <span className="select-chevron" aria-hidden />
      </button>
      {menu}
    </div>
  );
}
