export type ChatRequest = {
  message: string;
  model?: string;
  apiKey?: string;
  useInputCaching?: boolean;
};

export type ChatResponse = {
  reply: string;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chat request failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<ChatResponse>;
}
