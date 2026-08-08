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
  listening?: boolean;
  speechDraft?: string;
  micError?: string | null;
  open?: boolean;
  onSend: (text: string) => Promise<void> | void;
};

export function ChatPanel({
  messages,
  disabled,
  busy,
  status,
  listening = false,
  speechDraft = "",
  micError = null,
  open = true,
  onSend,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  useEffect(() => {
    if (!inputRef.current) return;
    if (listening) {
      inputRef.current.value = speechDraft;
    }
  }, [listening, speechDraft]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!open || listening || disabled || busy) return;
    const value = inputRef.current?.value.trim();
    if (!value) return;
    if (inputRef.current) inputRef.current.value = "";
    await onSend(value);
    inputRef.current?.focus();
  }

  return (
    <section className={`chat-panel${open ? "" : " is-collapsed"}`}>
      <header className="chat-header">
        <h2>Lesson chat</h2>
        {open && status ? <p className="chat-status">{status}</p> : null}
        {open && listening ? (
          <p className="chat-status chat-listening">
            Listening… click the mic again to send
          </p>
        ) : null}
        {open && micError ? (
          <p className="chat-status chat-mic-error">{micError}</p>
        ) : null}
      </header>

      {open ? (
        <>
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
                  : listening
                    ? "Listening…"
                    : "Type in English…"
              }
              disabled={disabled || busy || listening}
              autoComplete="off"
            />
            <button type="submit" disabled={disabled || busy || listening}>
              Send
            </button>
          </form>
        </>
      ) : (
        <div className="chat-collapsed-body">
          <p className="chat-collapsed-message">
            Chat is hidden. Press the <strong>Chat</strong> button in the call
            toolbar to show the conversation again.
          </p>
        </div>
      )}
    </section>
  );
}
