"use client";

import {
  ClaimStatusTable,
  ConfirmationCard,
  KnowledgeBaseCard,
  PolicySummaryCard,
  PremiumCalculationCard,
} from "@/components/InsuranceCards";
import { api, setAuthToken } from "@/lib/api";
import { useEffect, useRef, useState } from "react";

// Helper functions to render UI components (moved outside to be accessible)
const isPolicyPayload = (obj: any): boolean => {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj);
  return (
    keys.includes("collision_coverage") ||
    keys.includes("deductible") ||
    keys.includes("plan")
  );
};

const isClaimPayload = (obj: any): boolean => {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj);
  return (
    keys.includes("claim_id") ||
    (keys.includes("status") && keys.includes("policy_id"))
  );
};

const isKnowledgeBasePayload = (obj: any): boolean => {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj);
  return keys.includes("results") || keys.includes("sources");
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  expected_output?: any;
  ui?: {
    type:
      | "policy_details"
      | "claim_status"
      | "knowledge_base"
      | "premium_calculation";
    data: any;
  };
}

interface Action {
  type: string;
  id: string;
  summary: string;
  payload: any;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Welcome to Insurance Assistant! I can help you with:\n\n• Policy details and coverage information\n• Claim status and submission\n• Premium calculations\n• General insurance questions\n\nTry asking: 'What are my policy details for USER-001?' or 'Check claim status 98765'",
    },
  ]);
  const [actions, setActions] = useState<Action[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState("web-session-1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
    console.log("DEBUG: Token from localStorage:", token);
    setAuthToken(token);

    // Check if token is set in API headers
    console.log(
      "DEBUG: API Authorization header:",
      api.defaults.headers.common["Authorization"]
    );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);
    setBusy(true);

    console.log("DEBUG: === SEND FUNCTION START ===");
    console.log("DEBUG: Input text:", text);
    console.log("DEBUG: Session ID:", sessionId);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    console.log("DEBUG: User message created:", userMsg);
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      console.log("DEBUG: Making API call to /chat");
      console.log(
        "DEBUG: Current Authorization header:",
        api.defaults.headers.common["Authorization"]
      );

      const res = await api.post("/chat", {
        message: text,
        session_id: sessionId,
      });
      console.log("DEBUG: API response received:", res);
      console.log("DEBUG: Response status:", res.status);
      console.log("DEBUG: Response headers:", res.headers);
      const data = res.data;

      if (data?.messages) {
        console.log("DEBUG: API response data:", data);
        console.log("DEBUG: Messages from API:", data.messages);

        // Map API response fields to frontend expected format
        const messagesWithIds = data.messages.map((msg: any, index: number) => {
          console.log(`DEBUG: Processing message ${index}:`, msg);

          // Check if the message content is a JSON string with UI data
          let ui = msg.ui;
          let content = msg.text || msg.content || "";

          console.log(`DEBUG: Message ${index} content:`, content);
          console.log(`DEBUG: Message ${index} ui:`, ui);

          // SPECIAL CONDITION: Check if this is a policy response from orchestrator
          if (
            msg.from === "assistant" &&
            typeof content === "string" &&
            content.trim().startsWith("{")
          ) {
            try {
              // Handle Python dictionary syntax (single quotes, True/False/None)
              const cleanedContent = content
                .replace(/'/g, '"') // Replace single quotes with double quotes
                .replace(/\bTrue\b/g, "true")
                .replace(/\bFalse\b/g, "false")
                .replace(/\bNone\b/g, "null");

              const parsed = JSON.parse(cleanedContent);
              console.log("DEBUG: Parsed orchestrator response:", parsed);

              // Check if this contains policy data
              if (
                parsed.plan &&
                parsed.collision_coverage &&
                parsed.deductible
              ) {
                console.log("DEBUG: Detected policy data, setting UI type");
                ui = {
                  type: "policy_details",
                  data: parsed,
                };
                // Replace raw JSON with user-friendly message
                content = `Policy details for ${parsed.user_id || "user"}: ${
                  parsed.plan
                } plan with $${parsed.collision_coverage.toLocaleString()} collision coverage and $${
                  parsed.deductible
                } deductible.`;
              }
              // Check if this contains premium calculation data
              else if (
                parsed.current_premium &&
                parsed.new_premium &&
                parsed._inputs
              ) {
                console.log(
                  "DEBUG: Detected premium calculation data, setting UI type"
                );
                ui = {
                  type: "premium_calculation",
                  data: parsed,
                };
                // Replace raw JSON with user-friendly message
                content = `Premium calculation completed for policy ${parsed.policy_id}. Your premium will change from ${parsed.current_premium} to ${parsed.new_premium}.`;
              }
            } catch (e) {
              console.log(
                "DEBUG: JSON parse error for orchestrator response:",
                e
              );
            }
          }

          // Try to parse JSON content for UI data (from orchestrator)
          if (typeof content === "string" && content.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(content);
              if (parsed.ui) {
                ui = parsed.ui;
                content = parsed.message || content;
              }
            } catch (e) {
              // Not valid JSON, use original content
            }
          }

          const mappedMessage = {
            id: msg.id || `api-msg-${Date.now()}-${index}`,
            role:
              msg.from === "assistant"
                ? "assistant"
                : msg.from === "user"
                ? "user"
                : "system",
            content: content,
            ui: ui,
            expected_output: msg.expected_output,
          };

          console.log(`DEBUG: Mapped message ${index}:`, mappedMessage);
          return mappedMessage;
        });

        console.log("DEBUG: Final mapped messages:", messagesWithIds);
        setMessages((prev) => [...prev, ...messagesWithIds]);
      }
      setActions(data?.actions || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Send failed");
    } finally {
      setBusy(false);
      // Re-focus the input field after response
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  const approve = async () => {
    await send("yes");
  };

  const cancel = async () => {
    await send("no");
  };

  function parseLooseJSON(text: string): any | undefined {
    if (!text || typeof text !== "string") return undefined;
    const trimmed = text.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      try {
        const coerced = trimmed
          .replace(/'([^']*)'/g, '"$1"')
          .replace(/\bTrue\b/g, "true")
          .replace(/\bFalse\b/g, "false")
          .replace(/\bNone\b/g, "null");
        return JSON.parse(coerced);
      } catch {
        return undefined;
      }
    }
  }

  function shapeUiFromAny(
    output: any
  ):
    | { type: "policy_details" | "claim_status" | "knowledge_base"; data: any }
    | undefined {
    if (output == null) return undefined;
    if (Array.isArray(output)) {
      if (output.length === 0) return undefined;
      if (isClaimPayload(output[0]))
        return { type: "claim_status", data: output };
    } else if (typeof output === "object") {
      if (isPolicyPayload(output))
        return { type: "policy_details", data: output };
      if (isClaimPayload(output)) return { type: "claim_status", data: output };
      if (isKnowledgeBasePayload(output))
        return { type: "knowledge_base", data: output };
    }
    return undefined;
  }

  function looksLikeJsonString(text?: string): boolean {
    if (!text) return false;
    const t = text.trim();
    return t.startsWith("{") || t.startsWith("[");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-semibold">
              IA
            </span>
            <div className="font-semibold text-gray-900">
              Insurance Assistant
            </div>
            <div className="ml-3 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 border border-blue-200">
              OpenAI Agents SDK • Memory
            </div>
          </div>
          <div className="text-xs text-gray-500">session: {sessionId}</div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
        {/* Messages Container - Takes available space */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="w-full space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} onSend={send} />
            ))}
            {busy && (
              <div className="flex gap-2 p-2 text-sm text-gray-500">
                <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:120ms]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:240ms]" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Container - Fixed at Bottom */}
        <div className="border-t border-gray-200 bg-white px-4 py-4 mt-auto">
          <div className="w-full">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) {
                  send(input);
                }
              }}
              className="flex items-center gap-3"
            >
              <input
                ref={inputRef}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 outline-none ring-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Type a message… e.g., "What if I increase collision coverage from 50k to 80k?"'
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className={`rounded-xl px-6 py-3 text-sm font-medium shadow-sm transition-all duration-200 min-w-[80px] ${
                  busy || !input.trim()
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95"
                }`}
              >
                Send
              </button>
            </form>

            <div className="mt-2 text-xs text-gray-500 text-center">
              Tip: ask for policy details (USER-001), claim status (98765),
              submit a claim, calculate premium, or general questions.
            </div>
          </div>
        </div>
      </main>

      {/* Actions */}
      {actions
        .filter((a) => a.type === "confirm")
        .map((a) => (
          <div key={a.id} className="border rounded p-3 bg-yellow-50 mx-4 mb-4">
            <div className="mb-2">{a.summary}</div>
            <div className="flex gap-2">
              <button
                onClick={approve}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={cancel}
                className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      {error && (
        <div className="mx-4 mb-4 text-red-600 bg-red-50 p-3 rounded border border-red-200">
          {error}
        </div>
      )}

      <footer className="px-4 py-3 text-center text-xs text-gray-400 border-t border-gray-200 bg-white">
        Built with OpenAI Agents SDK • Powered by AI
      </footer>
    </div>
  );
}

function MessageBubble({
  msg,
  onSend,
}: {
  msg: ChatMessage;
  onSend: (text: string) => void;
}) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  // Auto-detect content type and render appropriate UI component
  const autoDetectContent = () => {
    if (isUser || isSystem) return null;

    // Try to parse content as JSON
    let parsedContent: any = null;
    try {
      if (
        typeof msg.content === "string" &&
        msg.content.trim().startsWith("{")
      ) {
        // Handle Python dictionary syntax (single quotes, True/False/None)
        const cleanedContent = msg.content
          .replace(/'/g, '"') // Replace single quotes with double quotes
          .replace(/\bTrue\b/g, "true")
          .replace(/\bFalse\b/g, "false")
          .replace(/\bNone\b/g, "null");

        parsedContent = JSON.parse(cleanedContent);
        console.log("DEBUG: Parsed JSON content:", parsedContent);
      } else if (typeof msg.content === "object") {
        parsedContent = msg.content;
        console.log("DEBUG: Object content:", parsedContent);
      }
    } catch (e) {
      console.log("DEBUG: JSON parse error:", e);
      // Not valid JSON, ignore
    }

    if (!parsedContent) {
      return null;
    }

    // Auto-detect policy data
    console.log("DEBUG: Checking if content is policy payload...");
    console.log("DEBUG: Parsed content keys:", Object.keys(parsedContent));
    console.log(
      "DEBUG: Checking for collision_coverage:",
      parsedContent.collision_coverage
    );
    console.log("DEBUG: Checking for deductible:", parsedContent.deductible);
    console.log("DEBUG: Checking for plan:", parsedContent.plan);

    if (isPolicyPayload(parsedContent)) {
      console.log(
        "DEBUG: Content IS policy payload, rendering PolicySummaryCard"
      );
      return (
        <div className="mt-3">
          <PolicySummaryCard data={parsedContent} />
        </div>
      );
    } else {
      console.log("DEBUG: Content is NOT policy payload");
      console.log("DEBUG: Policy detection failed");
    }

    // Auto-detect claim data
    if (isClaimPayload(parsedContent)) {
      return (
        <div className="mt-3">
          <ClaimStatusTable items={parsedContent} />
        </div>
      );
    }

    // Auto-detect knowledge base data
    if (isKnowledgeBasePayload(parsedContent)) {
      return (
        <div className="mt-3">
          <KnowledgeBaseCard data={parsedContent} />
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`my-2 flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
          isSystem
            ? "bg-amber-50 text-amber-900 border border-amber-200"
            : isUser
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-white text-gray-900 border border-gray-200 shadow-sm"
        }`}
      >
        {/* Show content only if it's not auto-detected as structured data */}
        {!autoDetectContent() && <div>{msg.content}</div>}

        {msg.expected_output && (
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <div className="border-b bg-gray-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Expected Output
            </div>
            <pre className="max-h-72 overflow-auto px-3 py-2 text-[12px] leading-relaxed text-gray-800">
              {JSON.stringify(msg.expected_output, null, 2)}
            </pre>
          </div>
        )}

        {/* Render UI components - prioritize explicit UI over auto-detection */}
        {msg.ui?.type === "policy_details" && (
          <div className="mt-3">
            <PolicySummaryCard data={msg.ui.data} />
          </div>
        )}

        {msg.ui?.type === "claim_status" && (
          <div className="mt-3">
            <ClaimStatusTable items={msg.ui.data} />
          </div>
        )}

        {msg.ui?.type === "knowledge_base" && (
          <div className="mt-3">
            <KnowledgeBaseCard data={msg.ui.data} />
          </div>
        )}

        {msg.ui?.type === "premium_calculation" && (
          <div className="mt-3">
            <PremiumCalculationCard data={msg.ui.data} />
          </div>
        )}

        {/* Confirmation Card - for claim status confirmation */}
        {msg.content.includes("Can you please confirm the claim ID") && (
          <div className="mt-3">
            <ConfirmationCard
              message={msg.content}
              onConfirm={() => {
                // Actually send "yes" as a message
                onSend("yes");
              }}
              onCancel={() => {
                // Send "no" as a message
                onSend("no");
              }}
            />
          </div>
        )}

        {/* Auto-detected UI components - only if no explicit UI is set */}
        {!msg.ui && autoDetectContent()}
      </div>
    </div>
  );
}
