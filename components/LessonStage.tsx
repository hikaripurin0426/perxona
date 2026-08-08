"use client";

import { useEffect, useRef } from "react";
import type { PresenterWidget } from "@/lib/types";

type Props = {
  ready: boolean;
  status: string;
  participantName?: string;
  speaking?: boolean;
  micSupported?: boolean;
  listening?: boolean;
  micDisabled?: boolean;
  onMicToggle?: () => void;
  chatOpen?: boolean;
  onChatToggle?: () => void;
  leaveDisabled?: boolean;
  onLeave?: () => void;
};

export function LessonStage({
  ready,
  status,
  participantName = "Tutor",
  speaking = false,
  micSupported = false,
  listening = false,
  micDisabled = false,
  onMicToggle,
  chatOpen = true,
  onChatToggle,
  leaveDisabled = false,
  onLeave,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const presenterRef = useRef<PresenterWidget | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || presenterRef.current) return;
    const el = document.createElement("sv-presenter") as PresenterWidget;
    el.setAttribute("hidden", "");
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.display = "block";
    host.append(el);
    presenterRef.current = el;
    return () => {
      el.remove();
      presenterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = presenterRef.current;
    if (!el) return;
    if (ready) {
      el.removeAttribute("hidden");
    } else {
      el.setAttribute("hidden", "");
    }
  }, [ready]);

  return (
    <section className={`meeting${ready ? " is-live" : ""}`}>
      <header className="meeting-topbar">
        <div className="meeting-topbar-left">
          <span className={`meeting-dot${ready ? " is-on" : ""}`} />
          <div>
            <p className="meeting-title">English Lesson</p>
            <p className="meeting-subtitle">
              {ready ? "Connected · Perxona Speak" : "Waiting to join"}
            </p>
          </div>
        </div>
        <div className="meeting-topbar-right">
          <span className="meeting-chip">{ready ? "In call" : "Offline"}</span>
          <span className="meeting-chip meeting-chip-muted">1 participant</span>
        </div>
      </header>

      <div className="meeting-canvas">
        <div
          className={`meeting-tile meeting-tile-main${
            speaking ? " is-speaking" : ""
          }`}
        >
          <div className="stage-host" ref={hostRef} />
          {!ready ? (
            <div className="stage-placeholder">
              <div className="meeting-empty-avatar" aria-hidden="true">
                {participantName.slice(0, 1).toUpperCase()}
              </div>
              <p>{status || "Choose an avatar and start your lesson."}</p>
            </div>
          ) : null}
          <div className="meeting-nameplate">
            <span
              className={`meeting-mic-dot${speaking ? " is-on" : ""}`}
              aria-hidden="true"
            />
            <span>{participantName}</span>
            {speaking ? (
              <span className="meeting-speaking-label">Speaking</span>
            ) : null}
          </div>
        </div>

        <aside className="meeting-tile meeting-tile-self" aria-label="You">
          <div className="meeting-self-avatar" aria-hidden="true">
            You
          </div>
          <div className="meeting-nameplate meeting-nameplate-self">
            <span>You</span>
          </div>
        </aside>
      </div>

      <footer className="meeting-toolbar">
        {micSupported ? (
          <button
            type="button"
            className={`meeting-tool meeting-tool-mic${
              listening ? " is-listening" : ""
            }`}
            onClick={onMicToggle}
            disabled={micDisabled}
            aria-pressed={listening}
            aria-label={
              listening ? "Stop voice input and send" : "Start voice input"
            }
            title={
              listening
                ? "Click to stop recognition and send"
                : "Click to start voice input"
            }
          >
            <ToolMic active={listening} />
          </button>
        ) : (
          <div
            className="meeting-tool meeting-tool-disabled"
            title="Microphone unsupported in this browser"
            aria-label="Microphone unsupported"
          >
            <ToolMic active={false} />
          </div>
        )}
        <button
          type="button"
          className={`meeting-tool meeting-tool-chat${
            chatOpen ? " is-active" : ""
          }`}
          onClick={onChatToggle}
          aria-pressed={chatOpen}
          aria-label={chatOpen ? "Hide lesson chat" : "Show lesson chat"}
          title={chatOpen ? "Hide lesson chat" : "Show lesson chat"}
        >
          <ToolChat />
          <span>Chat</span>
        </button>
        <button
          type="button"
          className="meeting-tool meeting-tool-leave"
          onClick={onLeave}
          disabled={leaveDisabled}
          aria-label="Leave lesson"
          title="Leave lesson"
        >
          <ToolLeave />
          <span>Leave</span>
        </button>
      </footer>
    </section>
  );
}

export function getPresenterElement(): PresenterWidget | null {
  return document.querySelector("sv-presenter") as PresenterWidget | null;
}

function ToolMic({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="meeting-tool-svg meeting-tool-svg-mic"
      aria-hidden="true"
    >      {active ? (
        <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
      ) : (
        <>
          <path
            d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M19 11a7 7 0 0 1-14 0M12 18v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function ToolChat() {
  return (
    <svg viewBox="0 0 24 24" className="meeting-tool-svg" aria-hidden="true">
      <path
        d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ToolLeave() {
  return (
    <svg viewBox="0 0 24 24" className="meeting-tool-svg" aria-hidden="true">
      <path
        d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M15 16l5-4-5-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 12H10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
