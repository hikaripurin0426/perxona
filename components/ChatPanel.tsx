"use client";

import { FormEvent, useEffect, useRef } from "react";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  messages: ChatTurn[];
  disabled?: boolean;
  busy?: boolean;
  status?: string;
  onSend: (text: string) => Promise<void> | void;
};

export function ChatPanel({
  messages,
  disabled,
  busy,
  status,
  onSend,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = inputRef.current?.value.trim();
    if (!value || disabled || busy) return;
    if (inputRef.current) inputRef.current.value = "";
    await onSend(value);
    inputRef.current?.focus();
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <h2>Lesson chat</h2>
        {status ? <p className="chat-status">{status}</p> : null}
      </header>
      <div className="chat-log" ref={listRef}>
        {messages.length === 0 ? (
          <p className="chat-empty">
            Start the lesson, then say hello in English.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`bubble bubble-${message.role}`}
            >
              <span className="bubble-role">
                {message.role === "user" ? "You" : "Tutor"}
              </span>
              <p>{message.content}</p>
            </div>
          ))
        )}
        {busy ? <p className="chat-busy">Tutor is thinking…</p> : null}
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          name="message"
          placeholder={
            disabled
              ? "Start the lesson to chat"
              : "Type in English…"
          }
          disabled={disabled || busy}
          autoComplete="off"
        />
        <button type="submit" disabled={disabled || busy}>
          Send
        </button>
      </form>
    </section>
  );
}
