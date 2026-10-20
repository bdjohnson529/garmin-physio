import Link from "next/link";

export function EmptyState({ message, actionLabel, href }: { message: string; actionLabel: string; href: string }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      <Link className="button button-primary" href={href}>
        {actionLabel}
      </Link>
    </div>
  );
}
