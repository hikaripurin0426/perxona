"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type Options = {
  enabled?: boolean;
  onStart?: () => void;
  onSubmit: (text: string) => void | Promise<void>;
};

export function useSpeechRecognition({
  enabled = true,
  onStart,
  onSubmit,
}: Options) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const shouldSendOnStopRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  const onStartRef = useRef(onStart);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled && listening) {
      shouldSendOnStopRef.current = false;
      recognitionRef.current?.stop();
    }
  }, [enabled, listening]);

  const stop = useCallback((send: boolean) => {
    shouldSendOnStopRef.current = send;
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor || !enabled) return;

    setError(null);
    finalTranscriptRef.current = "";
    setTranscript("");
    shouldSendOnStopRef.current = true;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = finalTranscriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result[0]?.transcript || "";
        if (result.isFinal) {
          finalChunk = `${finalChunk} ${piece}`.replace(/\s+/g, " ").trim();
        } else {
          interim += piece;
        }
      }
      finalTranscriptRef.current = finalChunk;
      setTranscript(`${finalChunk} ${interim}`.replace(/\s+/g, " ").trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone permission denied."
          : `Microphone error: ${event.error}`,
      );
      shouldSendOnStopRef.current = false;
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = finalTranscriptRef.current.trim();
      if (shouldSendOnStopRef.current && text) {
        shouldSendOnStopRef.current = false;
        void onSubmitRef.current(text);
      }
      setTranscript("");
      finalTranscriptRef.current = "";
    };

    recognitionRef.current = recognition;
    try {
      onStartRef.current?.();
      recognition.start();
      setListening(true);
    } catch {
      setError("Could not start microphone recognition.");
      recognitionRef.current = null;
      setListening(false);
    }
  }, [enabled]);

  const toggle = useCallback(() => {
    if (listening) {
      stop(true);
      return;
    }
    start();
  }, [listening, start, stop]);

  return {
    listening,
    supported,
    error,
    transcript,
    toggle,
    stop,
  };
}
