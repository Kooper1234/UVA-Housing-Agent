"use client";

import { FormEvent, useMemo, useState } from "react";

import type { Citation } from "@/types/listings";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: "assistant",
      text: "Ask about neighborhoods, prices, leases, transit, or how listings compare around UVA.",
    },
  ]);

  const canSend = input.trim().length > 0 && !loading;

  const chatTitle = useMemo(
    () => (loading ? "UVA Housing Assistant is thinking..." : "UVA Housing Assistant"),
    [loading],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      text: trimmed,
    };

    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          top_k: 5,
        }),
      });

      const payload = (await response.json()) as {
        answer?: string;
        citations?: Citation[];
        error?: string;
      };

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "Chat request failed.");
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        text: payload.answer,
        citations: payload.citations ?? [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const fallbackMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        text:
          error instanceof Error
            ? `I ran into an issue: ${error.message}`
            : "I ran into an unexpected issue while generating a response.",
      };

      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed right-5 bottom-5 z-[1200] inline-flex items-center rounded-full bg-[#232D4B] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#1c243c]"
        onClick={() => setIsOpen(true)}
      >
        Ask UVA Housing AI
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[1300] bg-slate-900/30">
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{chatTitle}</h2>
                <p className="text-xs text-slate-500">RAG over UVA housing sources</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  <div
                    className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "ml-auto bg-[#232D4B] text-white"
                        : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    {message.text}
                  </div>

                  {message.role === "assistant" && message.citations?.length ? (
                    <div className="space-y-1 pl-1 text-xs text-slate-600">
                      <p className="font-medium text-slate-700">Citations</p>
                      {message.citations.slice(0, 3).map((citation) => (
                        <div key={`${message.id}-${citation.id}`}>
                          {citation.source_url ? (
                            <a
                              href={citation.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#232D4B] underline-offset-2 hover:underline"
                            >
                              {citation.topic || "Source"}
                            </a>
                          ) : (
                            <span>{citation.topic || "Housing source"}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about rent, neighborhoods, commute..."
                  className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-[#E57200] transition focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="h-11 rounded-lg bg-[#E57200] px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#cc6200]"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
