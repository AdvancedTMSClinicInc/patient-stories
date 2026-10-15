"use client";

export default function PrintButton({ label = "Print or save a copy" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-outline btn-block" onClick={() => window.print()}>
      {label}
    </button>
  );
}
