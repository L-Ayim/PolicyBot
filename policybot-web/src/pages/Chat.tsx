import React, { useEffect, useRef, useState } from "react";
import { Edit, Trash2, User, Bot } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from 'react-markdown';
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
    } catch {}
    const seed: Session = {
      id: uuidv4(),
      title: "New chat",
      createdAt: Date.now(),
      messages: [],
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
    } catch {}
    return null;
  });

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0)
      setActiveSessionId(sessions[0].id);
  }, [sessions, activeSessionId]);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sidebarTitleDraft, setSidebarTitleDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // reduced motion
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) document.documentElement.classList.add("reduce-motion");
  }, []);

  function deleteSession(id: string) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const seed: Session = {
          id: uuidv4(),
          title: "New chat",
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

  // persist (keep last 20 msgs per session)
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
    } catch {}
  }, [sessions, activeSessionId]);

  // jump to bottom when switching sessions
  useEffect(() => {
    scrollToBottom();
  }, [activeSessionId]);

  // show/hide scroll-to-bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handleScroll = () => {
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
      setShowScrollToBottom(!isAtBottom);
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToBottom() {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  function stopGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSending(false);
  }

  function sendMessage() {
    if (!input.trim() || isSending || !activeSessionId) return;

    setIsSending(true);
    abortControllerRef.current = new AbortController();

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: input.trim(),
      createdAt: Date.now(),
    };

    const active = sessions.find((s) => s.id === activeSessionId);
    if (!active) {
      setIsSending(false);
      abortControllerRef.current = null;
      return;
    }

    const nextMessages = [...active.messages, userMsg];
    const nextSessions = sessions.map((s) =>
      s.id === activeSessionId ? { ...s, messages: nextMessages } : s
    );

    // auto-rename on first user msg
    let updatedSessions = nextSessions;
    const currentSession = nextSessions.find((s) => s.id === activeSessionId);
    if (currentSession && currentSession.title === "New chat") {
      const isFirstUserMessage = currentSession.messages.length === 1;
      if (isFirstUserMessage) {
        const generatedTitle =
          input.trim().length > 50
            ? input.trim().substring(0, 47) + "..."
            : input.trim();
        updatedSessions = nextSessions.map((s) =>
          s.id === activeSessionId ? { ...s, title: generatedTitle } : s
        );
      }
    }

    setSessions(updatedSessions);
    setInput("");

    const reply: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, reply] }
          : s
      )
    );
    // ensure the view scrolls to the new assistant placeholder (loader)
    // use a short timeout to allow React to render the new DOM node first
    setTimeout(scrollToBottom, 50);

    const messages = [
      { role: "system", content: "You are OmniBot, a helpful assistant." },
      ...nextMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:1b",
        messages,
        stream: true,
      }),
      signal: abortControllerRef.current.signal,
    })
      .then(async (res) => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        scrollToBottom();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line);
                  if (data.message?.content) {
                    accumulated += data.message.content;
                    setSessions((prev) =>
                      prev.map((s) =>
                        s.id === activeSessionId
                          ? {
                              ...s,
                              messages: s.messages.map((m) =>
                                m.id === reply.id
                                  ? { ...m, content: accumulated }
                                  : m
                              ),
                            }
                          : s
                      )
                    );
                  }
                } catch {
                  // ignore partial JSON during streaming
                }
              }
            }
          }
        } catch (err) {
          console.error("Streaming error:", err);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === reply.id
                        ? { ...m, content: `Echo: ${userMsg.content}` }
                        : m
                    ),
                  }
                : s
            )
          );
        } finally {
          setIsSending(false);
          abortControllerRef.current = null;
        }
      })
      .catch((err) => {
        console.error("Ollama error:", err);
        const fallback: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `Echo: ${userMsg.content}`,
          createdAt: Date.now(),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...s.messages, fallback] }
              : s
          )
        );
        setIsSending(false);
        abortControllerRef.current = null;
      });
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
    <div className="min-h-screen bg-[#F5F5F5] text-neutral-900">
      <main className="pt-6 pb-6 container mx-auto px-4 sm:px-6 lg:px-8">
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
                  <div className="omni-title">
                    <span style={{ color: "#2977BB" }}>Omni</span>
                    <span style={{ color: "#221D53" }}>Bot</span>
                  </div>
                </div>
                <button
                  onClick={newChat}
                  className="mt-3 w-full bg-gradient-to-r from-[#132B67] to-[#1052E0] text-white py-2 rounded-md hover:from-[#0f1e4a] hover:to-[#0c4a9e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2977BB]"
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
                      <div className="flex-1 min-w-0">
                        {editingSessionId === s.id ? (
                          <input
                            value={sidebarTitleDraft}
                            onChange={(e) =>
                              setSidebarTitleDraft(e.target.value)
                            }
                            onBlur={() => {
                              setSessions((prev) =>
                                prev.map((sess) =>
                                  sess.id === s.id
                                    ? {
                                        ...sess,
                                        title: sidebarTitleDraft || "New chat",
                                      }
                                    : sess
                                )
                              );
                              setEditingSessionId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setSessions((prev) =>
                                  prev.map((sess) =>
                                    sess.id === s.id
                                      ? {
                                          ...sess,
                                          title:
                                            sidebarTitleDraft || "New chat",
                                        }
                                      : sess
                                  )
                                );
                                setEditingSessionId(null);
                              }
                            }}
                            className="border-b border-neutral-200 text-sm focus:outline-none w-full"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <button
                            className="text-left w-full text-sm truncate"
                            onClick={() => setActiveSessionId(s.id)}
                          >
                            {s.title}{" "}
                            <span className="text-xs text-neutral-400">
                              {new Date(s.createdAt).toLocaleDateString()}
                            </span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(s.id);
                            setSidebarTitleDraft(s.title);
                          }}
                          className="shrink-0 text-neutral-400 hover:text-[#2977BB] focus:outline-none"
                          aria-label={`Edit ${s.title}`}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(s.id);
                            setShowDeleteModal(true);
                          }}
                          className="shrink-0 text-neutral-400 hover:text-red-600 focus:outline-none"
                          aria-label={`Delete ${s.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Chat */}
          <section className="lg:col-span-9 lg:col-start-4">
            {/* Header */}
            <div className="bg-white text-gray-500 rounded-t-2xl px-6 py-4 flex items-center justify-between">
              <div className="text-lg font-semibold">
                {sessions.find((s) => s.id === activeSessionId)?.title ??
                  "New chat"}
              </div>
            </div>

            {/* Chat area */}
            <div className="bg-white rounded-b-2xl h-[calc(100vh-8rem)] grid grid-rows-[1fr,auto] mb-2">
              {/* Messages */}
              <div
                className="relative overflow-y-auto p-6 pb-32 overscroll-contain"
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
                        className={`relative flex ${
                          m.role === "assistant"
                            ? "justify-start"
                            : "justify-end"
                        } w-full`}
                      >
                        {/* Avatar (ABSOLUTE) */}
                        {m.role === "assistant" ? (
                          <div className="absolute left-0 top-6 translate-y-0">
                            <div className="w-8 h-8 rounded-full bg-[#f0f4ff] flex items-center justify-center text-[#2977BB]">
                              <Bot size={16} />
                            </div>
                          </div>
                        ) : (
                          <div className="absolute right-0 top-6 translate-y-0">
                            <div className="w-8 h-8 rounded-full bg-[#2977BB] text-white flex items-center justify-center">
                              <User size={16} />
                            </div>
                          </div>
                        )}

                        {/* Content column (RESERVES space for avatar) */}
                        <div
                          className={`flex flex-col ${
                            m.role === "assistant"
                              ? "items-start pl-12"
                              : "items-end pr-12"
                          } w-full`}
                        >
                          {/* meta (name | time) */}
                          <div
                            className={`text-xs mb-2 font-medium text-black ${
                              m.role === "user" ? "text-right" : ""
                            }`}
                          >
                            {m.role === "assistant" ? "OmniBot" : "You"}{" "}
                            <span className="text-gray-500">
                              |{" "}
                              {new Date(
                                messagesTimestamp(m)
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {/* bubble */}
                          <div
                            className={`${
                              m.role === "assistant"
                                ? // Assistant a bit narrower for readability
                                  "bg-gradient-to-r from-[#132B67] to-[#1052E0] text-white max-w-[85%] md:max-w-[65%]"
                                : // User can be wider; true width no longer collides with avatar
                                  "bg-[#F2F2F7] text-black max-w-[95%] md:max-w-[80%]"
                            }
                            px-4 py-2.5 rounded-2xl leading-relaxed inline-block
                            min-w-[5ch] sm:min-w-[7ch]`}
                          >
                          <div
                            className="
                              whitespace-pre-wrap break-words
                              [overflow-wrap:anywhere]
                              [hyphens:auto]
                            "
                          >
                            {m.content.trim() === "" ? (
                              <div className="flex space-x-1 justify-center py-2">
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                            ) : (
                              <ReactMarkdown>
                                {m.content}
                              </ReactMarkdown>
                            )}
                          </div>                            {m.role === "assistant" && (m as any).citations && (
                              <div className="mt-2 text-sm text-neutral-300">
                                {(m as any).citations.map(
                                  (c: any, i: number) => (
                                    <div key={i}>
                                      {c.title} — {c.sectionOrPage}
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Scroll to bottom button */}
              {showScrollToBottom && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-4 right-4 bg-gradient-to-r from-[#132B67] to-[#1052E0] text-white p-3 rounded-md shadow-lg hover:from-[#0f1e4a] hover:to-[#0c4a9e] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2977BB]/40"
                  aria-label="Scroll to bottom"
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
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </button>
              )}

              {/* Composer */}
              <div
                className="bg-white p-4"
                style={{
                  paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
                }}
              >
                <div className="max-w-4xl mx-auto">
                  <div
                    className="
                      relative rounded-xl bg-gray-200
                      shadow-[0_1px_1px_rgba(0,0,0,0.04),0_8px_20px_rgba(0,0,0,0.06)]
                      ring-1 ring-neutral-200/60
                      focus-within:ring-2 focus-within:ring-[#2977BB]/30
                    "
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <textarea
                        ref={taRef}
                        aria-label="Ask me anything"
                        className="
                          flex-1 resize-none bg-gray-200
                          px-2 py-3
                          text-[15px] leading-6 text-black
                          placeholder:text-neutral-400
                          focus:outline-none
                          max-h-[192px] min-h-[40px]
                        "
                        placeholder="Ask me anything…"
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
                        onClick={isSending ? stopGeneration : sendMessage}
                        disabled={!input.trim() && !isSending}
                        aria-label={
                          isSending ? "Stop generation" : "Send message"
                        }
                        className={`
                          shrink-0 grid place-items-center
                          w-10 h-10 rounded-md
                          ${
                            isSending
                              ? "bg-gradient-to-r from-[#132B67] to-[#1052E0] text-white hover:from-[#0f1e4a] hover:to-[#0c4a9e]"
                              : "bg-gradient-to-r from-[#132B67] to-[#1052E0] text-white hover:from-[#0f1e4a] hover:to-[#0c4a9e]"
                          }
                          disabled:opacity-50
                          transition-transform hover:scale-[1.03] active:scale-[0.98]
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2977BB]/40
                        `}
                      >
                        {isSending ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                              fill="currentColor"
                            />
                          </svg>
                        ) : (
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
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm mx-4">
            <p className="text-lg font-semibold mb-4">Delete Chat</p>
            <p className="text-neutral-600 mb-6">
              Are you sure you want to delete this chat? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (sessionToDelete) deleteSession(sessionToDelete);
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
