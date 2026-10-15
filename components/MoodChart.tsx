import type { JournalEntry } from "@/lib/types";
import { fmtDay } from "@/lib/dates";

/** Simple line of mood scores (0–10) across the most recent entries. */
export default function MoodChart({ entries }: { entries: JournalEntry[] }) {
  const pts = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-12);
  if (pts.length < 2) {
    return <p className="small muted" style={{ margin: 0 }}>Your mood check-ins will appear here as a line once you have two or more entries.</p>;
  }
  const W = 320, H = 130, left = 26, right = 12, top = 12, bottom = 26;
  const x = (i: number) => left + (i * (W - left - right)) / (pts.length - 1);
  const y = (v: number) => top + ((10 - v) * (H - top - bottom)) / 10;
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.mood).toFixed(1)}`).join(" ");
  const first = pts[0], last = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Mood went from ${first.mood} on ${fmtDay(first.entryDate)} to ${last.mood} on ${fmtDay(last.entryDate)}`}
      style={{ width: "100%", height: "auto" }}
    >
      <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="#C9C3B3" />
      <line x1={left} x2={W - right} y1={y(5)} y2={y(5)} stroke="#ECE8DE" />
      <line x1={left} x2={W - right} y1={y(10)} y2={y(10)} stroke="#ECE8DE" />
      <text x={4} y={y(10) + 4} fontSize="10" fill="#4A5468">10</text>
      <text x={10} y={y(5) + 4} fontSize="10" fill="#4A5468">5</text>
      <text x={10} y={y(0) + 4} fontSize="10" fill="#4A5468">0</text>
      <path d={path} fill="none" stroke="#1E72B9" strokeWidth="2" />
      {pts.map((p, i) => (
        <circle key={p.id} cx={x(i)} cy={y(p.mood)} r={i === pts.length - 1 ? 5 : 3.5} fill={i === pts.length - 1 ? "#C9A24A" : "#1E72B9"} stroke={i === pts.length - 1 ? "#0F1E3D" : "none"} strokeWidth="1.5" />
      ))}
      <text x={x(0)} y={H - 6} fontSize="10" fill="#4A5468" textAnchor="start">{fmtDay(first.entryDate)}</text>
      <text x={x(pts.length - 1)} y={H - 6} fontSize="10" fill="#4A5468" textAnchor="end">{fmtDay(last.entryDate)}</text>
    </svg>
  );
}
