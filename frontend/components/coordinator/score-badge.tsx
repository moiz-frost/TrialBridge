import { cn } from "@/lib/utils";

export function ScoreBadge({
  score,
  label,
  size = "default",
}: {
  score: number;
  label?: string;
  size?: "sm" | "default";
}) {
  const color =
    score >= 80
      ? "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]"
      : score >= 60
        ? "text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)]"
        : "text-destructive bg-destructive/10";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg font-semibold",
        color,
        size === "sm" ? "h-10 w-10 text-xs" : "h-12 w-12 text-sm",
      )}
    >
      <span>{score}</span>
      {label && (
        <span className="text-[8px] font-medium uppercase tracking-wider opacity-70">
          {label}
        </span>
      )}
    </div>
  );
}
