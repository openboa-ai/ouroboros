export interface PendingMessage { key: string; text: string; replyTo: string | null; messageId?: string; }
/** An uncertain effect retains its exact payload. A new edit cannot reuse its key. */
export function retainMessage(storage: Pick<Storage, "getItem" | "setItem">, scope: string, proposed: PendingMessage): PendingMessage {
  const raw = storage.getItem(scope);
  if (raw) {
    const previous = JSON.parse(raw) as PendingMessage;
    if (typeof previous.key !== "string" || typeof previous.text !== "string") throw new Error("The retained message request is invalid.");
    if (previous.text !== proposed.text || previous.replyTo !== proposed.replyTo) throw new Error("Resolve the previous message before sending an edited message.");
    return previous;
  }
  storage.setItem(scope, JSON.stringify(proposed));
  return proposed;
}
