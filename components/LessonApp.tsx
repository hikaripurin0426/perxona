"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CatalogSelect,
  pickCuratedAvatarId,
} from "@/components/CatalogSelect";
import { ChatPanel, type ChatTurn } from "@/components/ChatPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoginButton } from "@/components/LoginButton";
import { getPresenterElement, LessonStage } from "@/components/LessonStage";
import { useAuth } from "@/hooks/useAuth";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  findFixedSceneId,
  findLessonAvatarOptionByCatalogId,
  resolveVoiceIdForAvatar,
} from "@/lib/avatars";
import type { MotionItem } from "@/lib/connect";
import {
  findMotionByKeywords,
  withMotionMarkup,
} from "@/lib/motions";
import {
  recordConversationDay,
  saveLevelAssessment,
} from "@/lib/userProfile";
import type { AppConfig, CatalogItem, PresenterWidget } from "@/lib/types";

const LEVEL_ASSESS_MIN_USER_TURNS = 3;

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
  const { user, profile, setProfile, needsNickname, loading: authLoading } =
    useAuth();
  const levelAssessStarted = useRef(false);
  const autoStartedRef = useRef(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [avatars, setAvatars] = useState<CatalogItem[]>([]);
  const [voices, setVoices] = useState<CatalogItem[]>([]);
  const [avatarId, setAvatarId] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [status, setStatus] = useState("Loading catalog…");
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const [stageParticipantName, setStageParticipantName] = useState("Tutor");
  const [catalogReady, setCatalogReady] = useState(false);
  const [motions, setMotions] = useState<MotionItem[]>([]);
  const motionsRef = useRef<MotionItem[]>([]);

  useEffect(() => {
    motionsRef.current = motions;
  }, [motions]);

  useEffect(() => {
    levelAssessStarted.current = false;
  }, [user?.uid]);

  useEffect(() => {
    if (!avatarId) {
      setMotions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const page = await api<{ items: MotionItem[] }>(
          `/api/avatars/${encodeURIComponent(avatarId)}/motions`,
        );
        if (cancelled) return;
        setMotions(page.items || []);
      } catch {
        if (!cancelled) setMotions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarId]);

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
        setCatalogReady(true);
        setStatus("Starting lesson…");
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

  async function speak(presenter: PresenterWidget, text: string) {
    setSpeaking(true);
    try {
      return await presenter.present(text);
    } finally {
      setSpeaking(false);
    }
  }

  async function playCueMotion(keywords: string[]) {
    const presenter = getPresenterElement();
    const motion = findMotionByKeywords(motionsRef.current, keywords);
    if (!presenter?.playMotion || !motion) return;
    try {
      await presenter.playMotion(motion.id);
    } catch {
      // Best-effort cue; speech can continue without it.
    }
  }

  const maybeAssessLevel = useCallback(
    async (transcript: ChatTurn[]) => {
      if (!user || !profile || profile.level != null) return;
      const userTurns = transcript.filter((m) => m.role === "user").length;
      if (userTurns < LEVEL_ASSESS_MIN_USER_TURNS) return;
      if (levelAssessStarted.current) return;
      levelAssessStarted.current = true;
      try {
        const assessment = await api<{
          level: number;
          levelLabel: string;
          reason: string;
        }>("/api/assess-level", {
          method: "POST",
          body: JSON.stringify({ messages: transcript }),
        });
        await saveLevelAssessment(user.uid, {
          level: assessment.level,
          levelLabel: assessment.levelLabel,
        });
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                level: assessment.level,
                levelLabel: assessment.levelLabel,
              }
            : prev,
        );
      } catch {
        levelAssessStarted.current = false;
      }
    },
    [user, profile, setProfile],
  );

  const sendMessage = useCallback(
    async (text: string) => {
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
        const { reply, script } = await api<{
          reply: string;
          script?: string;
          emotion?: string;
          intensity?: string;
        }>("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: nextMessages,
            learnerName: profile?.username || undefined,
            tutorName: stageParticipantName || undefined,
            levelLabel: profile?.levelLabel || undefined,
            avatarId: avatarId || undefined,
            voiceId: voiceId || undefined,
          }),
        });
        const withReply: ChatTurn[] = [
          ...nextMessages,
          { role: "assistant", content: reply },
        ];
        setMessages(withReply);

        if (user) {
          try {
            const updated = await recordConversationDay(user.uid);
            if (updated) setProfile(updated);
          } catch {
            // Progress is best-effort; lesson continues.
          }
          void maybeAssessLevel(withReply);
        }

        if (presenter) {
          const spokenText = script?.trim() || reply;
          const result = await speak(presenter, spokenText);
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
    },
    [
      config?.chat,
      messages,
      user,
      profile?.username,
      profile?.levelLabel,
      stageParticipantName,
      avatarId,
      voiceId,
      setProfile,
      maybeAssessLevel,
    ],
  );

  const speech = useSpeechRecognition({
    enabled: ready && !busy && !starting,
    onStart: () => {
      const presenter = getPresenterElement();
      void presenter?.interruptPresentation?.();
      void playCueMotion(["listen", "listening", "idle", "nod", "think"]);
    },
    onSubmit: sendMessage,
  });

  const startLesson = useCallback(async () => {
    if (!avatarId || !sceneId || !voiceId) {
      setStatus("Select avatar, scene, and voice first.");
      return;
    }
    const presenter = getPresenterElement();
    if (!presenter) {
      setStatus("Presenter is not mounted yet.");
      return;
    }
    speech.stop(false);
    void presenter.interruptPresentation?.();
    setMessages([]);
    setBusy(false);
    setSpeaking(false);
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
      const tutorName =
        findLessonAvatarOptionByCatalogId(avatars, avatarId)?.label || "Tutor";
      setStageParticipantName(tutorName);
      setStatus("Ready");
      const nick = profile?.username?.trim();
      const level = profile?.levelLabel?.toUpperCase();
      const topicAsk =
        level === "A1" || level === "A2" || !level
          ? "What did you do this morning?"
          : level === "B1"
            ? "Can you tell me about something interesting from your week?"
            : "What's been on your mind lately, and why?";
      const greeting = nick
        ? `Hi, ${nick}! I'm ${tutorName}. Today let's practice English together. ${topicAsk}`
        : `Hi! I'm ${tutorName}. Today let's practice English together. ${topicAsk}`;
      setMessages([{ role: "assistant", content: greeting }]);
      let cueMotions = motionsRef.current;
      if (avatarId && cueMotions.length === 0) {
        try {
          const page = await api<{ items: MotionItem[] }>(
            `/api/avatars/${encodeURIComponent(avatarId)}/motions`,
          );
          cueMotions = page.items || [];
          setMotions(cueMotions);
          motionsRef.current = cueMotions;
        } catch {
          cueMotions = [];
        }
      }
      const greetMotion = findMotionByKeywords(cueMotions, [
        "greet",
        "greeting",
        "wave",
        "hello",
        "bow",
      ]);
      const spoken = await speak(
        presenter,
        withMotionMarkup(greeting, greetMotion?.id || null),
      );
      if (!spoken?.success) {
        setStatus(spoken?.message || "Avatar ready, but greeting failed.");
      }
    } catch (err) {
      setReady(false);
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }, [
    avatarId,
    sceneId,
    voiceId,
    avatars,
    profile?.username,
    profile?.levelLabel,
    speech,
  ]);

  useEffect(() => {
    if (!catalogReady || autoStartedRef.current) return;
    if (authLoading || needsNickname) return;
    if (!avatarId || !sceneId || !voiceId || !config) return;
    if (ready || starting) return;

    let cancelled = false;
    let tries = 0;
    const timer = window.setInterval(() => {
      if (cancelled || autoStartedRef.current) {
        window.clearInterval(timer);
        return;
      }
      tries += 1;
      if (!getPresenterElement()) {
        if (tries > 60) window.clearInterval(timer);
        return;
      }
      autoStartedRef.current = true;
      window.clearInterval(timer);
      void startLesson();
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    catalogReady,
    authLoading,
    needsNickname,
    avatarId,
    sceneId,
    voiceId,
    config,
    ready,
    starting,
    startLesson,
  ]);

  function requestLeaveLesson() {
    if (!ready && !starting && !speaking && !busy) return;
    setLeaveConfirmOpen(true);
  }

  function confirmLeaveLesson() {
    setLeaveConfirmOpen(false);
    speech.stop(false);
    const presenter = getPresenterElement();
    void presenter?.interruptPresentation?.();
    setReady(false);
    setStarting(false);
    setBusy(false);
    setSpeaking(false);
    setMessages([]);
    setChatOpen(false);
    setStageParticipantName("Tutor");
    setStatus("Lesson ended. Press Start lesson to join again.");
  }

  if (bootError) {
    return (
      <main className="shell">
        <div className="boot-error">
          <h1>Avilingo</h1>
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
          <Link href="/" className="brand brand-link">
            Avilingo
          </Link>
        </div>
        <div className="topbar-actions">
          <LoginButton />
          <button
            type="button"
            className="start-btn"
            onClick={() => void startLesson()}
            disabled={
              starting ||
              needsNickname ||
              !config ||
              !avatarId ||
              !sceneId ||
              !voiceId
            }
          >
            {ready ? "Restart lesson" : starting ? "Starting…" : "Start lesson"}
          </button>
        </div>
      </header>

      <div className="layout">
        <LessonStage
          ready={ready}
          status={status}
          speaking={speaking}
          participantName={stageParticipantName}
          micSupported={speech.supported}
          listening={speech.listening}
          micDisabled={!ready || busy || starting}
          onMicToggle={speech.toggle}
          chatOpen={chatOpen}
          onChatToggle={() => setChatOpen((open) => !open)}
          leaveDisabled={!ready && !starting && !speaking && !busy}
          onLeave={requestLeaveLesson}
        />
        <aside className="sidebar">
          <CatalogSelect
            avatars={avatars}
            avatarId={avatarId}
            disabled={starting || speech.listening}
            onAvatarChange={(id) => selectAvatar(id, avatars, voices)}
          />
          {config && !config.chat ? (
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
            listening={speech.listening}
            speechDraft={speech.transcript}
            micError={speech.error}
            open={chatOpen}
            onSend={sendMessage}
          />
        </aside>
      </div>

      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Leave lesson?"
        message="This will end the conversation with the avatar. You can start again anytime."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={confirmLeaveLesson}
        onCancel={() => setLeaveConfirmOpen(false)}
      />
    </main>
  );
}
