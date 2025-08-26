"use client";

import { api, setAuthToken } from "@/lib/api";
import { useEffect, useState } from "react";

interface ChatMessage {
  from: string;
  text: string;
}
interface Action {
  type: string;
  id: string;
  summary: string;
  payload: any;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState("web-session-1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
    setAuthToken(token);
  }, []);

  const send = async (text: string) => {
    setError(null);
    try {
      const res = await api.post("/chat", {
        message: text,
        session_id: sessionId,
      });
      const data = res.data;
      if (data?.messages) setMessages((prev) => [...prev, ...data.messages]);
      setActions(data?.actions || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Send failed");
    }
  };

  const approve = async () => {
    await send("yes");
  };
  const cancel = async () => {
    await send("no");
  };

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto p-4 gap-4">
      <h1 className="text-xl font-semibold">Assistant</h1>
      <div className="flex-1 border rounded p-3 space-y-2 overflow-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.from === "assistant" ? "text-blue-700" : "text-gray-800"
            }
          >
            <b>{m.from}:</b> {m.text}
          </div>
        ))}
        {actions
          .filter((a) => a.type === "confirm")
          .map((a) => (
            <div key={a.id} className="border rounded p-3 bg-yellow-50">
              <div className="mb-2">{a.summary}</div>
              <div className="flex gap-2">
                <button
                  onClick={approve}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  Approve
                </button>
                <button
                  onClick={cancel}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        {error && <div className="text-red-600">{error}</div>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            setMessages((prev) => [...prev, { from: "user", text: input }]);
            send(input);
            setInput("");
          }
        }}
        className="flex gap-2"
      >
        <input
          className="flex-1 border rounded p-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
        />
        <button className="bg-blue-600 text-white rounded px-4">Send</button>
      </form>
    </div>
  );
}
