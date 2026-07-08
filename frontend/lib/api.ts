import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const register = async (email: string, password: string) => {
  const res = await api.post("/auth/register", { email, password });
  return res.data;
};

export const login = async (email: string, password: string) => {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
};

export const ingestRepo = async (repoUrl: string) => {
  const res = await api.post("/repos/ingest", { repo_url: repoUrl });
  return res.data;
};

export const askQuestion = async (repoName: string, query: string, history?: any[]) => {
  const res = await api.post("/chat/ask", { repo_name: repoName, query, history });
  return res.data;
};

export const getMyRepos = async () => {
  const res = await api.get("/repos/my-repos");
  return res.data;
};

export const getHistory = async (repoName: string) => {
  const res = await api.get("/chat/history", { params: { repo_name: repoName } });
  return res.data;
};

export const getRepoGraph = async (repoName: string) => {
  const res = await api.get(`/repos/${repoName}/graph`);
  return res.data;
};

export const getFileTree = async (repoName: string) => {
  const res = await api.get(`/repos/${repoName}/file-tree`);
  return res.data;
};

export const getCommits = async (repoName: string) => {
  const res = await api.get(`/repos/${repoName}/commits`);
  return res.data;
};

export const deleteRepo = async (repoName: string) => {
  const res = await api.delete(`/repos/${repoName}`);
  return res.data;
};

export const streamQuestion = (
  repoName: string,
  query: string,
  history: any[],
  onToken: (token: string) => void,
  onDone: (sources: string[], similarFiles: string[]) => void,
  onError: (err: string) => void
) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const url = `${process.env.NEXT_PUBLIC_API_URL}/chat/stream`;

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ repo_name: repoName, query, history }),
  }).then(async (res) => {
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n").filter((l) => l.startsWith("data: "));
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "token") onToken(data.content);
          else if (data.type === "done") onDone(data.sources, data.similar_files);
          else if (data.type === "error") onError(data.content);
        } catch {}
      }
    }
  }).catch((err) => onError(err.message));
};

export default api;