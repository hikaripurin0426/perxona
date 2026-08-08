"use client";

import { type FormEvent, useState } from "react";
import {
  isValidRomajiNickname,
  nicknameValidationMessage,
  normalizeNickname,
} from "@/lib/nickname";

type Props = {
  open: boolean;
  saving?: boolean;
  error?: string | null;
  onSubmit: (nickname: string) => Promise<void> | void;
};

export function NicknameSetupDialog({
  open,
  saving = false,
  error = null,
  onSubmit,
}: Props) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nick = normalizeNickname(value);
    const message = nicknameValidationMessage(nick);
    if (message || !isValidRomajiNickname(nick)) {
      setLocalError(message || "Invalid nickname.");
      return;
    }
    setLocalError(null);
    try {
      await onSubmit(nick);
    } catch {
      // Error surfaced via props.error
    }
  }

  return (
    <div className="confirm-overlay" role="presentation">
      <div
        className="confirm-dialog nickname-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nickname-dialog-title"
        aria-describedby="nickname-dialog-message"
      >
        <h2 id="nickname-dialog-title">Choose your nickname</h2>
        <p id="nickname-dialog-message">
          Pick a Roman-letter nickname. Your tutor will call you by this name
          in lessons.
        </p>
        <form className="nickname-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="nickname-label" htmlFor="nickname-input">
            Nickname
          </label>
          <input
            id="nickname-input"
            className="nickname-input"
            type="text"
            autoComplete="nickname"
            autoFocus
            spellCheck={false}
            maxLength={20}
            placeholder="e.g. Haruto"
            value={value}
            disabled={saving}
            onChange={(event) => {
              setValue(event.target.value);
              setLocalError(null);
            }}
          />
          <p className="nickname-hint">A–Z only, 2–20 letters</p>
          {localError || error ? (
            <p className="nickname-error">{localError || error}</p>
          ) : null}
          <div className="confirm-actions">
            <button
              type="submit"
              className="confirm-ok nickname-submit"
              disabled={saving}
            >
              {saving ? "Saving…" : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
