import React, { useEffect, useRef, useState } from "react";
import { Edit, Trash2, User, Bot, Lightbulb } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { ChatMessage } from "../types/chat";

const STORAGE_KEY = "policybot:state";

// Simple regex to detect basic math expressions
const mathRegex = /^\s*[\d\s\+\-\*\/\^\(\)\.\,eE]+\s*$/;

type Session = {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
};

export default function Chat() {
  function createGreetingMessage(): ChatMessage {
    const greetings = [
      "Hello, I'm Awal, your eBusiness assistant. How may I help you today?",
      "Hi there! I'm Awal, your dedicated eBusiness assistant. What can I assist you with?",
      "Welcome! I'm Awal, here to help with all your eBusiness needs. How can I support you today?",
      "Greetings! I'm Awal, your eBusiness assistant. What eBusiness questions do you have for me?",
      "Hello! I'm Awal, ready to assist with your eBusiness inquiries. How may I help you?",
    ];
    const randomGreeting =
      greetings[Math.floor(Math.random() * greetings.length)];
    return {
      id: uuidv4(),
      role: "assistant",
      content: randomGreeting,
      createdAt: Date.now(),
    };
  }

  async function calculateExpression(expression: string): Promise<string> {
    try {
      const response = await fetch("http://localhost:3001/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression }),
      });
      const data = await response.json();
      if (data.success) {
        return `The result of ${data.expression} is ${data.result}`;
      } else {
        return `Sorry, I couldn't calculate that expression. Error: ${data.error}`;
      }
    } catch (error) {
      console.error("Calculator API error:", error);
      return "Sorry, I couldn't connect to the calculator service. Please try again.";
    }
  }

  async function retrieveDocuments(
    query: string
  ): Promise<{ content: string; citations: any[] }> {
    try {
      const response = await fetch("http://localhost:3002/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      if (data.success && data.documents.length > 0) {
        const docsText = data.documents
          .map((doc: any) => `Document: ${doc.title}\n${doc.content}`)
          .join("\n\n");
        return {
          content: `Retrieved ${data.documents.length} relevant document(s):\n\n${docsText}`,
          citations: data.documents.map((doc: any) => ({
            id: doc.id,
            title: doc.title,
            type: "document",
          })),
        };
      } else {
        return {
          content: "No relevant documents found for this query.",
          citations: [],
        };
      }
    } catch (error) {
      console.error("Document retrieval error:", error);
      return {
        content:
          "Sorry, I couldn't retrieve relevant documents. Please try again.",
        citations: [],
      };
    }
  }

  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
          // Ensure all loaded sessions have at least one message (greeting) if they're new/empty
          const sessionsWithGreetings = parsed.sessions.map((s: any) => {
            if (
              (!s.messages || s.messages.length === 0) &&
              s.title === "New chat"
            ) {
              return {
                ...s,
                messages: [createGreetingMessage()],
              };
            }
            return s;
          });
          return sessionsWithGreetings as Session[];
        }
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
    const greetingMessage = createGreetingMessage();
    const seed: Session = {
      id: uuidv4(),
      title: "New chat",
      createdAt: Date.now(),
      messages: [greetingMessage],
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
        const greetingMessage = createGreetingMessage();
        const seed: Session = {
          id: uuidv4(),
          title: "New chat",
          createdAt: Date.now(),
          messages: [greetingMessage],
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

  async function sendMessage() {
    if (!input.trim() || isSending || !activeSessionId) return;

    // Check if input is a math expression
    if (mathRegex.test(input.trim())) {
      setIsSending(true);
      const result = await calculateExpression(input.trim());

      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: "user",
        content: input.trim(),
        createdAt: Date.now(),
      };

      const active = sessions.find((s) => s.id === activeSessionId);
      if (!active) {
        setIsSending(false);
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
        content: result,
        toolType: "calculator",
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
      return;
    }

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
    // allow React to render new assistant placeholder (loader)
    setTimeout(scrollToBottom, 50);

    const messages = [
      {
        role: "system",
        content:
          'You are Awal, a professional eBusiness assistant. You must strictly discuss only eCommerce, online marketing, digital business strategies, and related policies.  \nUnder no circumstances should you answer questions or provide information on topics outside eBusiness and related policies.  \nIf a user asks about anything outside this scope, reply firmly and politely:  \n"I\'m sorry, I can only assist with eBusiness-related topics, including eCommerce, marketing, digital business, and policies. Please ask questions related to these areas."  \nDo not provide any additional information or try to connect off-topic subjects to eBusiness. Always maintain a friendly and professional tone while strictly enforcing this topic restriction.  \n\nYou have access to a calculator tool for mathematical computations and a document retrieval tool for accessing eBusiness knowledge. When users ask questions that would benefit from specific eBusiness information, use the retrieve_documents function to search for relevant content. Always use retrieved documents to provide accurate, detailed answers. For calculations, use the calculate function with the exact mathematical expression.  \n\nWhen providing information from retrieved documents, provide the main answer first. Then, on a separate line, clearly indicate the source like this:  \nSource: Document titled "Digital Marketing Strategies"  \n\nThis helps users understand where the information comes from and keeps citations visually distinct from the main answer.',
      },
      ...nextMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    try {
      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "huihui_ai/nemotron-v1-abliterated",
          messages,
          stream: true,
          tools: [
            {
              type: "function",
              function: {
                name: "calculate",
                description:
                  "Evaluate a mathematical expression safely and return the result",
                parameters: {
                  type: "object",
                  properties: {
                    expression: {
                      type: "string",
                      description:
                        "The mathematical expression to calculate, e.g., '2 + 3 * 4' or '(10 + 5) / 3'",
                    },
                  },
                  required: ["expression"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "retrieve_documents",
                description:
                  "Search for relevant eBusiness documents and information based on a query",
                parameters: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description:
                        "The search query for finding relevant eBusiness information",
                    },
                  },
                  required: ["query"],
                },
              },
            },
          ],
        }),
        signal: abortControllerRef.current!.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let toolCalls: any[] = [];
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
                if (data.message?.tool_calls) {
                  toolCalls = data.message.tool_calls;
                }
              } catch {
                // ignore partial JSON during streaming
              }
            }
          }
        }

        // Handle tool calls after streaming is complete
        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            let toolResult = "";
            let toolCitations: any[] = [];
            let toolType = "";

            if (toolCall.function?.name === "calculate") {
              const expression = toolCall.function.arguments?.expression;
              if (expression) {
                toolResult = await calculateExpression(expression);
                toolType = "calculator";
              }
            } else if (toolCall.function?.name === "retrieve_documents") {
              const query = toolCall.function.arguments?.query;
              if (query) {
                const ragResult = await retrieveDocuments(query);
                toolResult = ragResult.content;
                toolCitations = ragResult.citations;
                toolType = "rag";
              }
            }

            if (toolResult) {
              // Add tool result message to conversation
              const toolMessage = {
                role: "tool",
                content: toolResult,
                tool_call_id: toolCall.id,
                citations: toolCitations,
                toolType: toolType,
              };

              // Continue conversation with tool result
              const messagesWithTool = [
                ...messages,
                {
                  role: "assistant",
                  content: accumulated,
                  tool_calls: toolCalls,
                },
                toolMessage,
              ];

              // Make another API call to get the final response
              const followUpRes = await fetch(
                "http://localhost:11434/api/chat",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: "huihui_ai/nemotron-v1-abliterated",
                    messages: messagesWithTool,
                    stream: true,
                  }),
                }
              );

              const followUpReader = followUpRes.body!.getReader();
              const followUpDecoder = new TextDecoder();
              let followUpAccumulated = accumulated;

              try {
                while (true) {
                  const { done, value } = await followUpReader.read();
                  if (done) break;
                  const chunk = followUpDecoder.decode(value, { stream: true });
                  const lines = chunk.split("\n");
                  for (const line of lines) {
                    if (line.trim()) {
                      try {
                        const data = JSON.parse(line);
                        if (data.message?.content) {
                          followUpAccumulated += data.message.content;
                          setSessions((prev) =>
                            prev.map((s) =>
                              s.id === activeSessionId
                                ? {
                                    ...s,
                                    messages: s.messages.map((m) =>
                                      m.id === reply.id
                                        ? {
                                            ...m,
                                            content: followUpAccumulated,
                                            toolType: toolType,
                                            citations: toolCitations,
                                          }
                                        : m
                                    ),
                                  }
                                : s
                            )
                          );
                        }
                      } catch {}
                    }
                  }
                }
              } catch (followUpErr) {
                console.error("Follow-up streaming error:", followUpErr);
              }
            }
          }
        }
      } catch (err) {
        console.error("Streaming error:", err);
        if (!(err instanceof Error) || err.name !== "AbortError") {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === reply.id
                        ? {
                            ...m,
                            content:
                              "I'm sorry, I encountered an error while generating a response. Please try again.",
                          }
                        : m
                    ),
                  }
                : s
            )
          );
        }
      }
    } catch (err) {
      console.error("Ollama error:", err);
      if (!(err instanceof Error) || err.name !== "AbortError") {
        const fallback: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content:
            "I'm sorry, I couldn't connect to the AI service. Please check your connection and try again.",
          createdAt: Date.now(),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...s.messages, fallback] }
              : s
          )
        );
      }
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  }

  function newChat() {
    const id = uuidv4();
    const greetingMessage = createGreetingMessage();
    const s: Session = {
      id,
      title: "New chat",
      createdAt: Date.now(),
      messages: [greetingMessage],
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
                    <span style={{ color: "#2977BB" }}>Awal</span>
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
                        {/* Avatar */}
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

                        {/* Content */}
                        <div
                          className={`flex flex-col ${
                            m.role === "assistant"
                              ? "items-start pl-12"
                              : "items-end pr-12"
                          } w-full`}
                        >
                          {/* Meta */}
                          <div
                            className={`text-xs mb-2 font-medium text-black flex items-center gap-2 ${
                              m.role === "user" ? "text-right justify-end" : ""
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {m.role === "assistant" ? "Awal" : "You"}
                              {m.toolType === "calculator" && (
                                <span
                                  className="inline-flex items-center justify-center w-4 h-4 bg-orange-500 text-white rounded-full text-xs"
                                  title="Calculator used"
                                >
                                  🧮
                                </span>
                              )}
                              {m.toolType === "rag" && (
                                <span
                                  className="inline-flex items-center justify-center w-4 h-4 bg-green-500 text-white rounded-full text-xs"
                                  title="Knowledge base used"
                                >
                                  📚
                                </span>
                              )}
                            </div>
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

                          {/* Bubble */}
                          <div
                            className={`${
                              m.role === "assistant"
                                ? "bg-gradient-to-r from-[#132B67] to-[#1052E0] text-white max-w-[85%] md:max-w-[65%]"
                                : "bg-[#F2F2F7] text-black max-w-[95%] md:max-w-[80%]"
                            } px-4 py-2.5 rounded-2xl leading-relaxed inline-block min-w-[5ch] sm:min-w-[7ch]`}
                          >
                            <div className="whitespace-pre-wrap break-words [hyphens:auto]">
                              {m.content.trim() === "" ? (
                                <div className="flex space-x-1 justify-center py-2">
                                  <div
                                    className="w-2 h-2 bg-white rounded-full animate-bounce"
                                    style={{ animationDelay: "0s" }}
                                  ></div>
                                  <div
                                    className="w-2 h-2 bg-white rounded-full animate-bounce"
                                    style={{ animationDelay: "0.1s" }}
                                  ></div>
                                  <div
                                    className="w-2 h-2 bg-white rounded-full animate-bounce"
                                    style={{ animationDelay: "0.2s" }}
                                  ></div>
                                </div>
                              ) : (
                                <div className="markdown">
                                  {(() => {
                                    // Parse content to separate main answer from citations
                                    const content = m.content;
                                    const sourceMatch =
                                      content.match(/\nSource: (.+)$/);

                                    if (sourceMatch) {
                                      const mainContent = content.replace(
                                        /\nSource: .+$/,
                                        ""
                                      );
                                      const sourceText = sourceMatch[1];

                                      return (
                                        <>
                                          <ReactMarkdown
                                            remarkPlugins={[
                                              remarkMath,
                                              [
                                                remarkGfm,
                                                { singleTilde: false },
                                              ],
                                            ]}
                                            rehypePlugins={[rehypeKatex]}
                                            components={{
                                              ol: ({ children, ...props }) => (
                                                <ol
                                                  style={{
                                                    paddingLeft: "1.5rem",
                                                    margin: "0.5rem 0",
                                                  }}
                                                  {...props}
                                                >
                                                  {children}
                                                </ol>
                                              ),
                                              ul: ({ children, ...props }) => (
                                                <ul
                                                  style={{
                                                    paddingLeft: "1.5rem",
                                                    margin: "0.5rem 0",
                                                  }}
                                                  {...props}
                                                >
                                                  {children}
                                                </ul>
                                              ),
                                              li: ({ children, ...props }) => (
                                                <li
                                                  style={{
                                                    marginBottom: "0.25rem",
                                                  }}
                                                  {...props}
                                                >
                                                  {children}
                                                </li>
                                              ),
                                            }}
                                          >
                                            {mainContent}
                                          </ReactMarkdown>
                                          <div className="mt-3 pt-2 border-t border-white/20">
                                            <div className="text-xs text-white/70 italic">
                                              Source: {sourceText}
                                            </div>
                                          </div>
                                        </>
                                      );
                                    }

                                    return (
                                      <ReactMarkdown
                                        remarkPlugins={[
                                          remarkMath,
                                          [remarkGfm, { singleTilde: false }],
                                        ]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                          ol: ({ children, ...props }) => (
                                            <ol
                                              style={{
                                                paddingLeft: "1.5rem",
                                                margin: "0.5rem 0",
                                              }}
                                              {...props}
                                            >
                                              {children}
                                            </ol>
                                          ),
                                          ul: ({ children, ...props }) => (
                                            <ul
                                              style={{
                                                paddingLeft: "1.5rem",
                                                margin: "0.5rem 0",
                                              }}
                                              {...props}
                                            >
                                              {children}
                                            </ul>
                                          ),
                                          li: ({ children, ...props }) => (
                                            <li
                                              style={{
                                                marginBottom: "0.25rem",
                                              }}
                                              {...props}
                                            >
                                              {children}
                                            </li>
                                          ),
                                        }}
                                      >
                                        {m.content}
                                      </ReactMarkdown>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                            {m.role === "assistant" &&
                              m.citations &&
                              m.citations.length > 0 &&
                              !m.content.includes("Source:") && (
                                <div className="mt-3 pt-2 border-t border-white/20">
                                  <div className="text-xs text-white/70 mb-1">
                                    Sources:
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {m.citations.map((c, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center px-2 py-1 bg-white/10 text-white/90 rounded-md text-xs"
                                        title={
                                          c.type === "document"
                                            ? "From knowledge base"
                                            : "Source"
                                        }
                                      >
                                        📄 {c.title}
                                      </span>
                                    ))}
                                  </div>
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
                  <div className="relative rounded-xl bg-gray-200 shadow-[0_1px_1px_rgba(0,0,0,0.04),0_8px_20px_rgba(0,0,0,0.06)] ring-1 ring-neutral-200/60 focus-within:ring-2 focus-within:ring-[#2977BB]/30">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <textarea
                        ref={taRef}
                        aria-label="Ask me anything"
                        className="flex-1 resize-none bg-gray-200 px-2 py-3 text-[15px] leading-6 text-black placeholder:text-neutral-400 focus:outline-none max-h-[192px] min-h-[40px]"
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
                        className={`shrink-0 grid place-items-center w-10 h-10 rounded-md ${
                          isSending
                            ? "bg-gradient-to-r from-[#132B67] to-[#1052E0] text-white hover:from-[#0f1e4a] hover:to-[#0c4a9e]"
                            : "bg-gradient-to-r from-[#132B67] to-[#1052E0] text-white hover:from-[#0f1e4a] hover:to-[#0c4a9e]"
                        } disabled:opacity-50 transition-transform hover:scale-[1.03] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2977BB]/40`}
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="bg-white rounded-2xl w-full max-w-md mx-auto p-6 shadow-[0_10px_30px_rgba(16,24,40,0.08)] ring-1 ring-neutral-200/60">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EEF6FF] flex items-center justify-center text-[#132B67] shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3
                  id="delete-modal-title"
                  className="text-lg font-semibold text-neutral-900"
                >
                  Delete chat
                </h3>
                <p className="text-sm text-neutral-600 mt-2">
                  Are you sure you want to delete this chat? This action cannot
                  be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-neutral-100 text-neutral-800 rounded-md hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2977BB]/20"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (sessionToDelete) deleteSession(sessionToDelete);
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 bg-gradient-to-r from-[#132B67] to-[#1052E0] text-white rounded-md hover:from-[#0f1e4a] hover:to-[#0c4a9e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2977BB]/40"
              >
                Delete chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
