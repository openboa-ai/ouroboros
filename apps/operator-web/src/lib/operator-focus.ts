export const OPERATOR_NARROW_DETAIL_QUERY = "(max-width: 63.999rem)";

type FocusTarget = Pick<HTMLElement, "focus">;
type MediaMatcher = (query: string) => boolean;

export function focusNarrowDetail(
  target: FocusTarget | null,
  matches: MediaMatcher = (query) => (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(query).matches
  )
): void {
  if (target && matches(OPERATOR_NARROW_DETAIL_QUERY)) {
    target.focus();
  }
}
