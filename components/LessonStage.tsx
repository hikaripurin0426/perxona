"use client";

import { useEffect, useRef } from "react";
import type { PresenterWidget } from "@/lib/types";

type Props = {
  ready: boolean;
  status: string;
};

export function LessonStage({ ready, status }: Props) {
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
    <section className="stage">
      <div className="stage-host" ref={hostRef} />
      {!ready ? (
        <div className="stage-placeholder">
          <p>{status || "Choose an avatar and start your lesson."}</p>
        </div>
      ) : null}
    </section>
  );
}

export function getPresenterElement(): PresenterWidget | null {
  return document.querySelector("sv-presenter") as PresenterWidget | null;
}
