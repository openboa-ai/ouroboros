import { Avatar, AvatarFallback } from "@/ui/primitives/avatar";
// UX: ../../../../../docs/design/UI_PURPOSE_CONTRACT.md#c-10
export function Member({
  name = "Agent",
  role = "Member",
  compact = false,
}: {
  name?: string;
  role?: string;
  compact?: boolean;
}) {
  return (
    <span className="person">
      <Avatar size={compact ? "sm" : "default"} className="member-avatar">
        <AvatarFallback>{name[0]}</AvatarFallback>
      </Avatar>
      <span className="person-copy">
        <span className="type-control">{name}</span>
        <span className="type-meta muted">{role}</span>
      </span>
    </span>
  );
}
