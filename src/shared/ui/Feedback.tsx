import type { ReactNode } from "react";

const toneClasses = {
  error: "feedback-error",
  success: "feedback-success",
  info: "feedback-info",
};

export function Feedback({
  children,
  tone = "info",
  onRetry,
}: {
  children: ReactNode;
  tone?: "error" | "success" | "info";
  onRetry?: () => void;
}) {
  return (
    <div
      className={`feedback ${toneClasses[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span>{children}</span>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
