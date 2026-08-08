export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CatalogItem = {
  id: string;
  name?: string;
  [key: string]: unknown;
};

export type CatalogPage = {
  items: CatalogItem[];
  [key: string]: unknown;
};

export type AppConfig = {
  chat: boolean;
  presenterUrl: string;
  defaults: {
    avatarId: string;
    sceneId: string;
    voiceId: string;
  };
};

export type PresentationTarget = {
  avatarId: string;
  sceneId: string;
  voiceId: string;
};

export type PresentationResult = {
  success: boolean;
  code?: string;
  message?: string;
};

export type PresenterWidget = HTMLElement & {
  initialize: (connectToken: string, target: PresentationTarget) => Promise<void>;
  present: (content: string) => Promise<PresentationResult>;
  playMotion?: (motionId: string) => Promise<PresentationResult>;
  resumeAudioPlayback: () => Promise<void>;
  interruptPresentation: () => Promise<void> | void;
  refreshConnectToken: (connectToken: string) => Promise<void> | void;
};
