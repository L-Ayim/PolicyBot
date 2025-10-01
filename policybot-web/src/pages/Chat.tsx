import React, { useEffect, useRef, useState } from "react";
import { Edit, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ChatMessage } from "../types/chat";

const STORAGE_KEY = "policybot:state";

type Session = {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
};

export default function Chat() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.sessions) && parsed.sessions.length > 0)
          return parsed.sessions as Session[];
        if (Array.isArray(parsed.messages)) {
          return [
            {
              id: uuidv4(),
              title: "Imported",
              createdAt: Date.now(),
              messages: parsed.messages as ChatMessage[],
            },
          ];
        }
      }
    } catch (e) {}
    const seed: Session = {
      id: uuidv4(),
      title: "Welcome",
      createdAt: Date.now(),
      messages: [
        {
          id: uuidv4(),
          role: "assistant",
          content:
            "Welcome to Policy Bot. Ask about a policy and I will cite official documents.",
          citations: [
            { title: "Company Policy Handbook", sectionOrPage: "Section 4.2" },
          ],
          createdAt: Date.now(),
        },
      ],
    };
    return [seed];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          parsed.activeSessionId &&
          Array.isArray(parsed.sessions) &&
          parsed.sessions.find((s: any) => s.id === parsed.activeSessionId)
        ) {
          return parsed.activeSessionId as string;
        }
        if (Array.isArray(parsed.sessions) && parsed.sessions.length > 0)
          return parsed.sessions[0].id;
      }
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0)
      setActiveSessionId(sessions[0].id);
  }, [sessions, activeSessionId]);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const active = sessions.find((s) => s.id === activeSessionId);
    setTitleDraft(active?.title ?? "");
  }, [activeSessionId, sessions]);

  function deleteSession(id: string) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const seed: Session = {
          id: uuidv4(),
          title: "Welcome",
          createdAt: Date.now(),
          messages: [],
        };
        setActiveSessionId(seed.id);
        return [seed];
      }
      if (activeSessionId === id) {
        setActiveSessionId(next[0].id);
      }
      return next;
    });
  }

  function messagesTimestamp(m: ChatMessage) {
    return m.createdAt ?? Date.now();
  }

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) document.documentElement.classList.add("reduce-motion");
  }, []);

  useEffect(() => {
    try {
      const persist = {
        sessions: sessions.map((s) => ({
          ...s,
          messages: s.messages.slice(-20),
        })),
        activeSessionId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    } catch (e) {}
  }, [sessions, activeSessionId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sessions, activeSessionId]);

  function sendMessage() {
    if (!input.trim() || isSending) return;
    if (!activeSessionId) return;
    setIsSending(true);
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: input.trim(),
      createdAt: Date.now(),
    };
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, userMsg] }
          : s
      )
    );
    setInput("");
    setTimeout(() => {
      const reply: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: `Echo: ${userMsg.content}`,
        createdAt: Date.now(),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, reply] }
            : s
        )
      );
      setIsSending(false);
    }, 450);
  }

  function newChat() {
    const id = uuidv4();
    const s: Session = {
      id,
      title: "New chat",
      createdAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(id);
  }

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 6 * 24) + "px";
  }, [input]);

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-neutral-900">
      <main className="pt-6 container mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="hidden lg:block fixed left-4 top-6 w-64 h-[calc(100vh-3rem)]">
            <div className="bg-white rounded-2xl p-4 w-full flex flex-col h-full">
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src="/src/assets/OmniBSIC_Logo.png"
                    alt="Omni"
                    className="w-8 h-8"
                  />
                  <div className="omni-title">Policy Bot</div>
                </div>
                <button
                  onClick={newChat}
                  className="mt-3 w-full bg-blue-600 text-white py-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  New Chat
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <h4 className="text-sm font-semibold mb-3">Chats</h4>
                <div className="space-y-2 text-sm text-neutral-600">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between px-2 py-2 rounded-md hover:bg-neutral-50 ${
                        s.id === activeSessionId ? "bg-neutral-50" : ""
                      }`}
                    >
                      <button
                        className="text-left w-full text-sm"
                        onClick={() => setActiveSessionId(s.id)}
                      >
                        {s.title}{" "}
                        <span className="text-xs text-neutral-400">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(s.id);
                          setShowDeleteModal(true);
                        }}
                        className="ml-2 shrink-0 text-neutral-400 hover:text-red-600 focus:outline-none"
                        aria-label={`Delete ${s.title}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Chat */}
          <section className="lg:col-span-9 lg:col-start-4">
            <div className="bg-white rounded-2xl h-[calc(100vh-4rem)] grid grid-rows-[auto,1fr,auto] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    {editingTitle ? (
                      <input
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={() => {
                          setEditingTitle(false);
                          setSessions((prev) =>
                            prev.map((s) =>
                              s.id === activeSessionId
                                ? { ...s, title: titleDraft || "New chat" }
                                : s
                            )
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setSessions((prev) =>
                              prev.map((s) =>
                                s.id === activeSessionId
                                  ? { ...s, title: titleDraft || "New chat" }
                                  : s
                              )
                            );
                            setEditingTitle(false);
                          }
                        }}
                        className="border-b border-neutral-200 text-lg font-semibold focus:outline-none"
                      />
                    ) : (
                      <div className="text-lg font-semibold">
                        {sessions.find((s) => s.id === activeSessionId)
                          ?.title ?? "Live Chat"}
                      </div>
                    )}
                    <button
                      onClick={() => setEditingTitle((v) => !v)}
                      className="text-neutral-400 hover:text-neutral-600 focus:outline-none"
                      aria-label="Edit session title"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages (safe padding + subtle bottom fade) */}
              <div
                className="relative overflow-y-auto p-6 pb-28 overscroll-contain"
                ref={listRef}
                aria-live="polite"
              >
                <div className="space-y-6">
                  {(() => {
                    const active =
                      sessions.find((s) => s.id === activeSessionId) ??
                      sessions[0];
                    if (!active) return null;
                    return active.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${
                          m.role === "assistant"
                            ? "justify-start"
                            : "justify-end"
                        } w-full`}
                      >
                        {m.role === "assistant" && (
                          <div className="flex items-start mr-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-semibold">
                              AI
                            </div>
                          </div>
                        )}
                        <div
                          className={`${
                            m.role === "assistant"
                              ? "bg-neutral-100 text-neutral-900"
                              : "bg-blue-600 text-white"
                          } px-5 py-3 rounded-2xl break-words leading-relaxed`}
                          style={{ maxWidth: "68%" }}
                        >
                          <div className="whitespace-pre-wrap">{m.content}</div>
                          {m.role === "assistant" && (m as any).citations && (
                            <div className="mt-2 text-sm text-neutral-500">
                              {(m as any).citations.map((c: any, i: number) => (
                                <div key={i}>
                                  {c.title} — {c.sectionOrPage}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-neutral-400 mt-2 text-right">
                            {new Date(messagesTimestamp(m)).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </div>
                        </div>
                        {m.role === "user" && (
                          <div className="flex items-start ml-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                              Y
                            </div>
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>

                {/* subtle seam fade */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#f6f9fc] via-white to-transparent" />
              </div>

              {/* Composer Dock */}
              <div className="bg-[#f6f9fc] p-4 safe-area-inset-b">
                <div className="max-w-4xl mx-auto">
                  {/* Light-float pill: tiny shadow + thin ring on focus */}
                  <div
                    className="
                      relative rounded-xl bg-white
                      shadow-[0_1px_1px_rgba(0,0,0,0.04),0_8px_20px_rgba(0,0,0,0.06)]
                      ring-1 ring-neutral-200/60
                      focus-within:ring-2 focus-within:ring-blue-500/30
                    "
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <textarea
                        ref={taRef}
                        aria-label="Ask about a policy"
                        className="
                          flex-1 resize-none bg-transparent
                          px-2 py-3
                          text-[15px] leading-6
                          placeholder:text-neutral-400
                          focus:outline-none
                          max-h-[192px] min-h-[48px]
                        "
                        placeholder="Ask about a policy…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={isSending || !input.trim()}
                        aria-label="Send message"
                        className="
                          shrink-0 grid place-items-center
                          w-10 h-10 rounded-full
                          bg-blue-600 text-white
                          disabled:opacity-50
                          transition-transform hover:scale-[1.03] active:scale-[0.98]
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40
                        "
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 12h14M12 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* helper row removed */}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm mx-4">
            <p className="text-lg font-semibold mb-4">Delete Chat</p>
            <p className="text-neutral-600 mb-6">Are you sure you want to delete this chat? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (sessionToDelete) {
                    deleteSession(sessionToDelete);
                  }
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
