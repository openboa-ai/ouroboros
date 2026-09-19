/** Shared by navigation and category tabs; zero and unavailable counts remain visually quiet. */
export function UnreadBadge({ count }: { count?: number }) {
  if (!Number.isSafeInteger(count) || !count || count < 0) return null;
  return <span className="unread-badge type-meta" aria-label={`${count} unread`}>{count > 99 ? "99+" : count}</span>;
}
