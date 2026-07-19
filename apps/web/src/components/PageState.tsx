import { AlertTriangle, Loader2, SearchX } from "lucide-react";
import type { ReactNode } from "react";

type PageStateProps = {
  tone: "loading" | "error" | "empty";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
};

export function PageState({ tone, title, children, action }: PageStateProps) {
  const Icon = tone === "loading" ? Loader2 : tone === "error" ? AlertTriangle : SearchX;

  return (
    <div className={`page-state page-state--${tone}`}>
      <span className="page-state__icon">
        <Icon className={tone === "loading" ? "spin" : undefined} size={22} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
