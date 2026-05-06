export type Provider = "OpenAI" | "Anthropic" | "Google" | "DeepSeek" | "Minimax";

export type ProviderModel = {
    id: string;
    outputPer1M: number | null; // USD per 1M output tokens
};

export const API_PROVIDERS: Provider[] = ["OpenAI", "Anthropic", "Google", "DeepSeek", "Minimax"];

export const PROVIDER_COLORS: Record<Provider, string> = {
    OpenAI: "bg-[#10a37f]",
    Anthropic: "bg-[#d4712a]",
    Google: "bg-[#4285f4]",
    DeepSeek: "bg-[#7c6fcd]",
    Minimax: "bg-[#e74c3c]",
};

export const PROVIDER_MODELS: Record<Provider, ProviderModel[]> = {
    OpenAI: [
        { id: "gpt-5-mini", outputPer1M: null },
        { id: "gpt-5.5", outputPer1M: 30.0 },
        { id: "gpt-5.5-pro", outputPer1M: 180.0 },
        { id: "gpt-5.4", outputPer1M: 15.0 },
        { id: "gpt-5.4-mini", outputPer1M: 4.5 },
        { id: "gpt-5.4-nano", outputPer1M: 1.25 },
        { id: "gpt-5.4-pro", outputPer1M: 180.0 },
        { id: "gpt-5.3-chat-latest", outputPer1M: 14.0 },
        { id: "gpt-5.3-codex", outputPer1M: 14.0 },
        { id: "gpt-4.1", outputPer1M: 8.0 },
        { id: "gpt-4.1-mini", outputPer1M: 1.6 },
        { id: "gpt-4.1-nano", outputPer1M: 0.4 },
        { id: "gpt-4o", outputPer1M: 10.0 },
        { id: "gpt-4o-mini", outputPer1M: 0.6 },
        { id: "gpt-4-turbo", outputPer1M: 30.0 },
        { id: "gpt-3.5-turbo", outputPer1M: 1.5 },
    ],

    Anthropic: [
        { id: "claude-haiku-4.5", outputPer1M: 5.0 },
        { id: "claude-opus-4.7", outputPer1M: 25.0 },
        { id: "claude-opus-4.6", outputPer1M: 25.0 },
        { id: "claude-opus-4.5", outputPer1M: 25.0 },
        { id: "claude-opus-4.1", outputPer1M: 75.0 },
        { id: "claude-opus-4", outputPer1M: 75.0 },
        { id: "claude-sonnet-4.6", outputPer1M: 15.0 },
        { id: "claude-sonnet-4.5", outputPer1M: 15.0 },
        { id: "claude-sonnet-4", outputPer1M: 15.0 },
        { id: "claude-3.7-sonnet", outputPer1M: 15.0 },
        { id: "claude-3.5-haiku", outputPer1M: 4.0 },
        { id: "claude-3-haiku", outputPer1M: 1.25 },
    ],

    Google: [
        { id: "gemini-3.1-flash", outputPer1M: 1.5 },
        { id: "gemini-3.1-pro", outputPer1M: 12.0 },
        { id: "gemini-3.1-flash-lite", outputPer1M: 0.75 },
        { id: "gemini-2.5-pro", outputPer1M: 10.0 },
        { id: "gemini-2.5-flash", outputPer1M: 2.5 },
        { id: "gemini-2.5-flash-lite", outputPer1M: 0.4 },
    ],

    DeepSeek: [
        { id: "deepseek-v4-flash", outputPer1M: 0.28 },
        { id: "deepseek-chat", outputPer1M: 0.28 },
        { id: "deepseek-reasoner", outputPer1M: 2.19 },
        { id: "deepseek-v4-pro", outputPer1M: 3.48 },
    ],

    Minimax: [
        { id: "MiniMax-M2.7", outputPer1M: 1.2 },
        { id: "MiniMax-M2.7-highspeed", outputPer1M: 2.4 },
        { id: "MiniMax-M2.5", outputPer1M: 1.2 },
        { id: "MiniMax-M2.5-highspeed", outputPer1M: 2.4 },
        { id: "M2-her", outputPer1M: 1.2 },
        { id: "MiniMax-M2.1", outputPer1M: 1.2 },
        { id: "MiniMax-M2.1-highspeed", outputPer1M: 2.4 },
        { id: "MiniMax-M2", outputPer1M: 1.2 },
    ],
};
