"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CatalogSelect,
  pickCuratedAvatarId,
} from "@/components/CatalogSelect";
import { ChatPanel, type ChatTurn } from "@/components/ChatPanel";
import { getPresenterElement, LessonStage } from "@/components/LessonStage";
import {
  findFixedSceneId,
  resolveVoiceIdForAvatar,
} from "@/lib/avatars";
import type { AppConfig, CatalogItem, PresenterWidget } from "@/lib/types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Request failed (${response.status})`;
    throw Object.assign(new Error(String(message)), {
      status: response.status,
      data,
    });
  }
  return data as T;
}

function loadPresenterEngine(presenterUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-perxona-presenter="1"]`,
    );
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = presenterUrl;
    script.dataset.perxonaPresenter = "1";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Failed to load presenter from ${presenterUrl}`));
    document.head.append(script);
  });
}

export function LessonApp() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [avatars, setAvatars] = useState<CatalogItem[]>([]);
  const [voices, setVoices] = useState<CatalogItem[]>([]);
  const [avatarId, setAvatarId] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading catalog…");
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);

  function selectAvatar(
    nextAvatarId: string,
    catalogAvatars: CatalogItem[],
    catalogVoices: CatalogItem[],
  ) {
    setAvatarId(nextAvatarId);
    const nextVoiceId = resolveVoiceIdForAvatar(
      nextAvatarId,
      catalogAvatars,
      catalogVoices,
    );
    if (!nextVoiceId) {
      setVoiceId("");
      setStatus("Fixed voice for the selected avatar was not found.");
      return;
    }
    setVoiceId(nextVoiceId);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, avatarPage, scenePage, voicePage] = await Promise.all([
          api<AppConfig>("/api/config"),
          api<{ items: CatalogItem[] }>("/api/avatars"),
          api<{ items: CatalogItem[] }>("/api/scenes"),
          api<{ items: CatalogItem[] }>("/api/voices"),
        ]);
        if (cancelled) return;
        const catalogAvatars = avatarPage.items || [];
        const catalogVoices = voicePage.items || [];
        setConfig(cfg);
        setAvatars(catalogAvatars);
        setVoices(catalogVoices);
        const nextAvatarId = pickCuratedAvatarId(
          catalogAvatars,
          cfg.defaults.avatarId,
        );
        const fixedSceneId = findFixedSceneId(scenePage.items || []);
        if (!fixedSceneId) {
          throw new Error(
            "Fixed scene sova_interior_37_Inside_Training_B01_Chloe was not found in the catalog.",
          );
        }
        setSceneId(fixedSceneId);
        if (!nextAvatarId) {
          throw new Error("No curated avatars were found in the catalog.");
        }
        selectAvatar(nextAvatarId, catalogAvatars, catalogVoices);
        const resolvedVoice = resolveVoiceIdForAvatar(
          nextAvatarId,
          catalogAvatars,
          catalogVoices,
        );
        if (!resolvedVoice) {
          throw new Error(
            "Fixed voice for the default avatar was not found in the catalog.",
          );
        }
        await loadPresenterEngine(cfg.presenterUrl);
        if (cancelled) return;
        setStatus("Ready to start. Press Start lesson.");
      } catch (err) {
        if (cancelled) return;
        setBootError(err instanceof Error ? err.message : String(err));
        setStatus("Failed to load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshToken = useCallback(async (presenter: PresenterWidget) => {
    const { connect_token } = await api<{ connect_token: string }>(
      "/api/connect-token",
    );
    await presenter.refreshConnectToken(connect_token);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const presenter = getPresenterElement();
    if (!presenter) return;

    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: string }>).detail;
      if (detail?.status) setStatus(detail.status);
      if (detail?.status === "Ready") setReady(true);
    };
    const onExpired = () => {
      void refreshToken(presenter).catch((err) => {
        setStatus(
          err instanceof Error
            ? err.message
            : "Failed to refresh Connect token",
        );
      });
    };

    presenter.addEventListener("PRESENTER_STATUS", onStatus);
    presenter.addEventListener("CONNECT_TOKEN_EXPIRED", onExpired);
    return () => {
      presenter.removeEventListener("PRESENTER_STATUS", onStatus);
      presenter.removeEventListener("CONNECT_TOKEN_EXPIRED", onExpired);
    };
  }, [ready, refreshToken]);

  async function waitForReady(presenter: PresenterWidget, timeoutMs = 30000) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        presenter.removeEventListener("PRESENTER_STATUS", onStatus);
        reject(new Error("Timed out waiting for presenter Ready"));
      }, timeoutMs);

      const onStatus = (event: Event) => {
        const detail = (event as CustomEvent<{ status?: string }>).detail;
        if (detail?.status === "Ready") {
          clearTimeout(timer);
          presenter.removeEventListener("PRESENTER_STATUS", onStatus);
          resolve();
        }
      };
      presenter.addEventListener("PRESENTER_STATUS", onStatus);
    });
  }

  async function startLesson() {
    if (!avatarId || !sceneId || !voiceId) {
      setStatus("Select avatar, scene, and voice first.");
      return;
    }
    const presenter = getPresenterElement();
    if (!presenter) {
      setStatus("Presenter is not mounted yet.");
      return;
    }
    setStarting(true);
    setStatus("Starting lesson…");
    try {
      await presenter.resumeAudioPlayback();
      const { connect_token } = await api<{ connect_token: string }>(
        "/api/connect-token",
      );
      const readyPromise = waitForReady(presenter);
      await presenter.initialize(connect_token, {
        avatarId,
        sceneId,
        voiceId,
      });
      await readyPromise;
      setReady(true);
      setStatus("Ready");
      if (messages.length === 0) {
        const greeting =
          "Hi! I'm your English tutor. How are you today?";
        setMessages([{ role: "assistant", content: greeting }]);
        const spoken = await presenter.present(greeting);
        if (!spoken?.success) {
          setStatus(spoken?.message || "Avatar ready, but greeting failed.");
        }
      }
    } catch (err) {
      setReady(false);
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  async function sendMessage(text: string) {
    if (!config?.chat) {
      setStatus("OPENAI_API_KEY is not configured.");
      return;
    }
    const presenter = getPresenterElement();
    const nextMessages: ChatTurn[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    setBusy(true);
    setStatus("Waiting for tutor…");
    try {
      const { reply } = await api<{ reply: string }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: nextMessages }),
      });
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      if (presenter) {
        const result = await presenter.present(reply);
        if (!result?.success) {
          setStatus(result?.message || "Avatar could not speak.");
        } else {
          setStatus("Ready");
        }
      } else {
        setStatus("Ready");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (bootError) {
    return (
      <main className="shell">
        <div className="boot-error">
          <h1>Perxona Speak</h1>
          <p>{bootError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="backdrop" aria-hidden="true" />
      <header className="topbar">
        <div>
          <p className="brand">Perxona Speak</p>
          <p className="tagline">English conversation with an AI avatar</p>
        </div>
        <div className="topbar-actions">
          <span className={`pill ${ready ? "pill-on" : ""}`}>
            {ready ? "Live" : "Idle"}
          </span>
          <button
            type="button"
            className="start-btn"
            onClick={() => void startLesson()}
            disabled={starting || !config || !avatarId || !sceneId || !voiceId}
          >
            {ready ? "Restart lesson" : starting ? "Starting…" : "Start lesson"}
          </button>
        </div>
      </header>

      <div className="layout">
        <LessonStage ready={ready} status={status} />
        <aside className="sidebar">
          <CatalogSelect
            avatars={avatars}
            avatarId={avatarId}
            disabled={starting}
            onAvatarChange={(id) => selectAvatar(id, avatars, voices)}
          />
          {!config?.chat ? (
            <p className="hint">
              Set <code>OPENAI_API_KEY</code> in <code>.env.local</code> to
              enable tutor replies.
            </p>
          ) : null}
          <ChatPanel
            messages={messages}
            disabled={!ready}
            busy={busy}
            status={status}
            onSend={sendMessage}
          />
        </aside>
      </div>
    </main>
  );
}
