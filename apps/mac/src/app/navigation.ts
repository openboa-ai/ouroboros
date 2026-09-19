import type { ContextReference, Destination, DetailTarget } from "./contracts";
export interface NavigationState {
  destination: Destination;
  stack: DetailTarget[];
  context: ContextReference | null;
  returnTo: { destination: Destination; stack: DetailTarget[] } | null;
}
export const initialNavigation: NavigationState = {
  destination: "home",
  stack: [],
  context: null,
  returnTo: null,
};
export type NavigationAction =
  | { type: "navigate"; destination: Destination }
  | { type: "open"; target: DetailTarget }
  | { type: "patch-detail"; patch: Partial<DetailTarget> }
  | { type: "close" }
  | { type: "back" }
  | { type: "discuss"; context: ContextReference }
  | { type: "return" }
  | { type: "clear-context" };
export function navigationReducer(
  state: NavigationState,
  action: NavigationAction,
): NavigationState {
  switch (action.type) {
    case "navigate":
      return { ...state, destination: action.destination, stack: [] };
    case "open":
      return { ...state, stack: [...state.stack, action.target] };
    case "patch-detail":
      return {
        ...state,
        stack: state.stack.map((item, index) =>
          index === state.stack.length - 1
            ? { ...item, ...action.patch }
            : item,
        ),
      };
    case "close":
      return { ...state, stack: [] };
    case "back":
      return { ...state, stack: state.stack.slice(0, -1) };
    case "discuss":
      return {
        ...state,
        returnTo: { destination: state.destination, stack: state.stack },
        destination: "conversations",
        stack: [],
        context: action.context,
      };
    case "return":
      return state.returnTo
        ? { ...state, ...state.returnTo, returnTo: null }
        : state;
    case "clear-context":
      return { ...state, context: null };
  }
}
