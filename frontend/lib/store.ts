import { create } from "zustand";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

interface AppState {
  token: string | null;
  setToken: (token: string | null) => void;
  repoName: string | null;
  setRepoName: (name: string | null) => void;
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
}

export const useAppStore = create<AppState>((set) => ({
  token: null,
  setToken: (token) => {
    if (typeof window !== "undefined") {
      if (token) localStorage.setItem("token", token);
      else localStorage.removeItem("token");
    }
    set({ token });
  },
  repoName: null,
  setRepoName: (name) => set({ repoName: name, messages: [] }),
  messages: [],
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
}));