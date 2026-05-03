export const API_PROVIDERS = ["OpenAI", "Anthropic", "Google", "DeepSeek", "Minimax"] as const;

export type Provider = (typeof API_PROVIDERS)[number];

export const PROVIDER_COLORS: Record<Provider, string> = {
    OpenAI: "bg-[#10a37f]",
    Anthropic: "bg-[#d4712a]",
    Google: "bg-[#4285f4]",
    DeepSeek: "bg-[#7c6fcd]",
    Minimax: "bg-[#e74c3c]",
};

export const PROVIDER_MODELS: Record<Provider, string[]> = {
    OpenAI: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    Anthropic: ["claude-3.5-sonnet", "claude-3.5-haiku", "claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    Google: ["gemini-2.0-pro", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
    DeepSeek: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    Minimax: ["abab6.5-chat", "abab6.5s-chat", "abab6.5", "abab6.5s"],
};
