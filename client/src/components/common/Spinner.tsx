import { clsx } from "clsx";

export function Spinner({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center text-brand">
      <Spinner size={28} />
    </div>
  );
}
