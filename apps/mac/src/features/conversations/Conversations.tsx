import type { RoomId, RoomFilter, Message, Room } from "./model";
import { useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  MessageCircle,
  Reply,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Tabs, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import { EmptyState, Member, Status } from "@/ui/components/patterns";
import type { ContextReference, ViewProps } from "@/app/contracts";
import "@/ui/layouts/communication.css";

// UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#r-01
// All rooms are authorized sample memberships. Research exchange contains agent-authored
// messages; the owner is also a participant, not an invisible privileged observer.
export function ConversationsScreen({
  open,
  scenario,
  context,
  clearContext,
  rooms,
  delivery,
}: ViewProps & {
  context: ContextReference | null;
  clearContext: () => void;
  rooms: Room[];
  delivery?: { send: (room:Room,text:string,key:string,replyTo?:string,context?:ContextReference|null)=>Promise<void>; refresh:()=>Promise<void> };
}) {
  const [selected, setSelected] = useState<RoomId>(rooms[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [drafts, setDrafts] = useState<Partial<Record<RoomId, string>>>({});
  const [localMessages, setLocalMessages] = useState<
    Partial<Record<RoomId, Message[]>>
  >({});
  const [replies, setReplies] = useState<
    Partial<Record<RoomId, Message["replyTo"]>>
  >({});
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [sendKey, setSendKey] = useState<string|null>(null);
  const [receivedContext, setReceivedContext] = useState(context);
  const composer = useRef<HTMLTextAreaElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const readPositions = useRef<Partial<Record<RoomId, number>>>({});
  const composing = useRef(false);

  useLayoutEffect(() => {
    if (messageList.current)
      messageList.current.scrollTop = readPositions.current[selected] ?? 0;
  }, [selected]);

  // Each new reference object is an contextual conversation entry event from the shell.
  // Select its recipient before rendering, without resetting any room's draft
  // or pinning ordinary room navigation while the same reference stays attached.
  if (context !== receivedContext) {
    setReceivedContext(context);
    if (context) {
      const target=context.target;
      const matching=(target.kind==="conversation"?rooms.find(r=>r.id===target.id):undefined)??rooms.find(r=>r.workId===(target.workId??(target.kind==="work"?target.id:undefined)) || (target.kind==="member"&&r.agentId===target.id));
      setSelected(target.kind==="conversation" ? target.id??"" : matching?.id ?? rooms[0]?.id ?? "");
      setParticipantsOpen(false);
      setSaveNotice("");
    }
  }

  const unavailableReference=context?.target.kind==="conversation" && context.target.id===selected && !rooms.some(r=>r.id===selected);
  if (rooms.length && !rooms.some(r => r.id === selected) && !unavailableReference) setSelected(rooms[0].id);
  const room = rooms.find((candidate) => candidate.id === selected) ?? rooms[0];
  const visibleRooms = rooms.filter(
    (candidate) =>
      (filter === "all" || candidate.kind === filter) &&
      `${candidate.name} ${candidate.people} ${candidate.purpose}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const messages = [
    ...(scenario === "empty" ? [] : room?.messages ?? []),
    ...(localMessages[selected] ?? []),
  ];
  const matchingMessages = messages.filter((m) =>
    `${m.author} ${m.text} ${m.source?.label ?? ""}`
      .toLowerCase()
      .includes(messageSearch.toLowerCase()),
  );
  const draft = drafts[selected] ?? "";
  const reply = replies[selected];

  if (unavailableReference) return <EmptyState title="Referenced conversation not in view" detail="The selected room is not in the current permitted observation. Refresh the company records to check its availability." action={<Button variant="secondary" onClick={clearContext}>Back to conversations</Button>}/>;

  // UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#r-10
  function selectRoom(next: RoomId) {
    if (messageList.current)
      readPositions.current[selected] = messageList.current.scrollTop;
    setSelected(next);
    setMessageSearch("");
    setParticipantsOpen(false);
    setSaveNotice("");
  }

  // UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#r-05
  // This adds only a local demonstration record. It does not dispatch a message,
  // fabricate delivery, start a model, or manufacture an agent reply.
  async function saveLocally() {
    const text = draft.trim();
    if (!text || composing.current || sending || !room) return;
    if(delivery) {
      const key=sendKey ?? crypto.randomUUID();setSendKey(key);setSending(true);
      try { await delivery.send(room,text,key,reply?.id,context);setDrafts(current=>({...current,[selected]:""}));setSendKey(null);setReplies(current=>({...current,[selected]:undefined}));clearContext();await delivery.refresh();setSaveNotice("Stored. Delivery and replies are tracked separately."); }
      catch (error) { setSaveNotice(error instanceof Error ? error.message : "Message outcome unresolved. The original request is retained."); }
      finally {setSending(false);}
      return;
    }
    const message: Message = {
      id: `local-${crypto.randomUUID()}`,
      author: "You",
      text,
      time: new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      local: true,
      source: context
        ? { label: context.label, target: { ...context.target } }
        : undefined,
      replyTo: reply,
    };
    setLocalMessages((current) => ({
      ...current,
      [selected]: [...(current[selected] ?? []), message],
    }));
    setDrafts((current) => ({ ...current, [selected]: "" }));
    setReplies((current) => ({ ...current, [selected]: undefined }));
    clearContext();
    setSaveNotice(`Saved locally in ${room.name}. Not delivered.`);
    composer.current?.focus();
    requestAnimationFrame(() => {
      if (messageList.current)
        messageList.current.scrollTop = messageList.current.scrollHeight;
    });
  }

  if(!room)return <EmptyState title="No accessible conversations" detail="No room memberships were returned by the current environment."/>;
  return (
    <div className="communication-screen">
      <aside className="communication-rooms" aria-label="Conversation list">
        {/* UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#r-02 */}
        <label className="type-meta muted" htmlFor="conversation-search">
          Find a conversation
        </label>
        <div className="communication-search">
          <Search size={16} aria-hidden="true" />
          <Input
            id="conversation-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="People or subject"
          />
        </div>
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as RoomFilter)}
        >
          <TabsList aria-label="Conversation type">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="group">Groups</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="communication-room-list">
          {visibleRooms.map((candidate) => (
            <Button
              key={candidate.id}
              variant="ghost"
              className={`communication-room ${selected === candidate.id ? "is-selected" : ""}`}
              aria-pressed={selected === candidate.id}
              onClick={() => selectRoom(candidate.id)}
            >
              <span className="communication-room-symbol" aria-hidden="true">
                {candidate.kind === "personal" ? (
                  <MessageCircle size={18} />
                ) : (
                  <Users size={18} />
                )}
              </span>
              <span className="communication-room-copy">
                <span className="type-control">{candidate.name}</span>
                <span className="type-meta muted">{candidate.purpose}</span>
                {drafts[candidate.id]?.trim() && (
                  <span className="type-meta communication-draft">Draft</span>
                )}
              </span>
            </Button>
          ))}
          {!visibleRooms.length && (
            <div className="communication-no-rooms">
              <p className="type-data muted">No matching conversations</p>
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
        <p className="type-meta muted communication-membership">
          {delivery ? "Your accessible memberships" : "Your sample memberships only"}
        </p>
      </aside>

      <section
        className="communication-thread"
        aria-label={`${room.name} conversation`}
      >
        {/* UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#r-03 */}
        <header className="communication-thread-heading">
          <div>
            <h2 className="type-section">{room.name}</h2>
            <p className="type-meta muted">{room.people}</p>
          </div>
          <div className="detail-toolbar">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Search in conversation"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search size={16} />
            </Button>
            <Button
              variant="ghost"
              aria-expanded={participantsOpen}
              onClick={() => setParticipantsOpen((current) => !current)}
            >
              <Users size={16} />
              Participants
            </Button>
          </div>
        </header>
        {searchOpen && (
          <div className="conversation-find">
            <Input
              aria-label="Find in messages"
              placeholder="Search messages and references"
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
            />
            <span className="type-meta muted">
              {matchingMessages.length}{" "}
              {matchingMessages.length === 1 ? "result" : "results"}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close message search"
              onClick={() => {
                setSearchOpen(false);
                setMessageSearch("");
              }}
            >
              <X size={14} />
            </Button>
          </div>
        )}
        {participantsOpen && (
          <div className="communication-participants">
            <span className="type-meta muted">You · Owner</span>
            <Button
              variant="ghost"
              onClick={() => open({ kind: "member", id: room.agentId ?? "" })}
            >
              <Member name={room.recipientNames} role="Member" compact />
            </Button>

          </div>
        )}

        {/* UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#r-04 */}
        <div
          ref={messageList}
          className="communication-messages"
          aria-label="Messages"
          onScroll={(event) => {
            readPositions.current[selected] = event.currentTarget.scrollTop;
          }}
        >
          <div className="communication-date type-meta muted">
            {delivery ? "Retained conversation" : "September 13, 2026 · Sample conversation"}
          </div>
          {room.truncated && <p role="status" className="type-meta muted">Partial history · the first 200 messages are visible.</p>}
          {!messages.length && (
            <EmptyState
              title="No messages yet"
              detail={delivery ? "No stored messages were returned for this room." : "This sample room has no conversation history."}
            />
          )}
          {!!messages.length && !matchingMessages.length && (
            <EmptyState
              title="No matching messages"
              detail="Try a different phrase in this conversation."
              action={
                <Button variant="ghost" onClick={() => setMessageSearch("")}>
                  Clear message search
                </Button>
              }
            />
          )}
          {matchingMessages.map((message) => (
            <article
              key={message.id}
              className={`communication-message ${message.local ? "is-local" : ""}`}
            >
              <div className="communication-message-heading">
                {message.author === "You" ? (
                  <span className="type-control">You</span>
                ) : (
                  <Button
                    variant="ghost"
                    className="communication-author"
                    onClick={() =>
                      open({ kind: "member", id: message.authorId ?? message.author.toLowerCase() })
                    }
                  >
                    <Member
                      name={message.author}
                      role="Member"
                      compact
                    />
                  </Button>
                )}
                <time className="type-meta muted">
                  {scenario === "delayed" && !message.local
                    ? message.time.replace("20:", "17:")
                    : message.time}
                </time>
              </div>
              {message.replyTo && (
                <div className="communication-quote">
                  <span className="type-meta muted">
                    Reply to {message.replyTo.author}
                  </span>
                  <p className="type-data">{message.replyTo.text}</p>
                </div>
              )}
              <p className="type-body communication-message-text">
                {message.text}
              </p>
              {message.source && (
                <Button
                  variant="ghost"
                  className="communication-source"
                  onClick={() => open(message.source!.target)}
                >
                  <FileText size={16} />
                  <span className="type-data">{message.source.label}</span>
                  <ArrowRight size={14} />
                </Button>
              )}
              <div className="communication-message-footer">
                {message.local ? (
                  <span className="type-meta muted">
                    <Check size={12} aria-hidden="true" />
                    Saved locally · Not delivered
                  </span>
                ) : (
                  <span className="type-meta muted">{message.deliveryState}</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplies((current) => ({
                      ...current,
                      [selected]: {
                        id: message.id,
                        author: message.author,
                        text: message.text,
                      },
                    }));
                    composer.current?.focus();
                  }}
                >
                  <Reply size={14} />
                  Reply
                </Button>
              </div>
            </article>
          ))}
        </div>

        {/* UX: ../../../../../docs/design/COMMUNICATION_AND_LIBRARY_EXPERIENCE.md#r-06 */}
        <form
          className="communication-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void saveLocally();
          }}
        >
          <div className="communication-composer-heading">
            <label className="type-control" htmlFor="conversation-message">
              Message to {room.recipientNames}
            </label>
            <Status>{delivery ? "Gateway" : "Sample"}</Status>
          </div>
          {reply && (
            <div className="communication-composer-reference">
              <Reply size={14} />
              <span className="type-meta">Replying to {reply.author}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove reply reference"
                onClick={() =>
                  setReplies((current) => ({
                    ...current,
                    [selected]: undefined,
                  }))
                }
              >
                <X size={14} />
              </Button>
            </div>
          )}
          {context && (
            <div className="communication-composer-reference">
              <Button
                variant="ghost"
                className="communication-context-link"
                onClick={() => open(context.target)}
              >
                <FileText size={14} />
                <span className="type-meta">{context.label}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove attached context"
                onClick={clearContext}
              >
                <X size={14} />
              </Button>
            </div>
          )}
          <textarea
            ref={composer}
            id="conversation-message"
            className="type-body"
            value={draft}
            onChange={(event) =>
              setDrafts((current) => ({
                ...current,
                [selected]: event.target.value,
              }))
            }
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            placeholder="Ask a question or share your perspective…"
            rows={2}
            maxLength={4000}
            aria-describedby="conversation-preview-note"
          />
          <div className="communication-composer-footer">
            <span id="conversation-preview-note" className="type-meta muted">
              {delivery ? "Stored and delivered through your company" : "Not delivered · Cleared on reload"}
            </span>
            <Button type="submit" disabled={!draft.trim() || sending}>
              <Send size={14} />
              {delivery ? sending ? "Sending…" : "Send message" : "Save locally"}
            </Button>
          </div>
          <span className="type-meta muted" role="status" aria-live="polite">
            {saveNotice}
          </span>
        </form>
      </section>
    </div>
  );
}
