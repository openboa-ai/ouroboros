import { House, ListTodo, Users, Server, MessageCircle, Files, Bell, SlidersHorizontal, Plug, Building2, Blocks, Wrench } from "lucide-react";
export const destinations = Object.freeze([
  { id: "home", label: "Home", icon: House },
  { id: "work", label: "Work", icon: ListTodo },
  { id: "agents", label: "Agents", icon: Users },
  { id: "system", label: "System", icon: Server },
  { id: "conversations", label: "Conversations", icon: MessageCircle },
  { id: "library", label: "Library", icon: Files },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const);
export const settingsRoutes = Object.freeze([
  { id: "settings/general", label: "General", icon: SlidersHorizontal },
  { id: "settings/connections", label: "Connections", icon: Plug },
  { id: "settings/company", label: "Company", icon: Building2 },
  { id: "settings/modules", label: "Modules", icon: Blocks },
  { id: "settings/maintenance", label: "Maintenance", icon: Wrench },
] as const);
