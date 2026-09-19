import type { ContextReference } from "@/app/contracts";
export type RoomId = string;
export type RoomFilter = "all" | "personal" | "group";
export interface Message {
  id: string;
  author: string;
  authorId?: string;
  deliveryState?: string;
  text: string;
  time: string;
  source?: ContextReference;
  local?: boolean;
  replyTo?: { id?: string; author: string; text: string };
}
export interface Room {
  id: RoomId;
  name: string;
  people: string;
  purpose: string;
  kind: "personal" | "group";
  recipientNames: string;
  messages: Message[];
  agentId?: string;
  workId?: string;
  truncated?: boolean;
}
