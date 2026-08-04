"use client";

import { useEffect, useId, useRef } from "react";

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const keepButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    keepButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending, onCancel]);

  if (!open) return null;
  return <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
    <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <span className="confirmation-dialog-icon" aria-hidden="true">!</span>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      <div className="confirmation-dialog-actions">
        <button ref={keepButton} type="button" disabled={pending} onClick={onCancel}>Keep appointment</button>
        <button type="button" className="confirm-danger" disabled={pending} onClick={onConfirm}>{pending ? "Cancelling…" : confirmLabel}</button>
      </div>
    </section>
  </div>;
}
