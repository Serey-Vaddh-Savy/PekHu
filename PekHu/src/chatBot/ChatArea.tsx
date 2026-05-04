import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Send, Paperclip, Smile, Mic, X, Bot, File } from "lucide-react";
import { sendChatMessage, type ChatHistoryMessage } from "../../backend/chatApi";
import { type Provider } from "../data/api";
import ResponseChat from "./ResponseChat";
import QuestionChat, { type QuestionAnswer } from "./QuestionChat";

type AssistantResponse =
    | { type: "answer"; content: string }
    | { type: "question"; questions: string[] };

interface Message {
    id: number;
    role: "user" | "assistant";
    content: string;
    response?: AssistantResponse;
    file?: string;
    time: string;
}

const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const INITIAL_MESSAGES: Message[] = [
    {
        id: 1,
        role: "assistant",
        content: "Hi there! I'm PekHu AI. How can I help you today?",
        response: { type: "answer", content: "Hi there! I'm PekHu AI. How can I help you today?" },
        time: "10:01 AM",
    },
];

interface ChatAreaProps {
    provider: Provider | null;
    model: string | null;
}

function getSavedKeyForProvider(provider: Provider | null): string | null {
    if (!provider) return null;
    try {
        const raw = localStorage.getItem("peakhu_api_keys");
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { provider: Provider; key: string }[];
        const match = parsed.find((entry) => entry.provider === provider);
        return match?.key ?? null;
    } catch {
        return null;
    }
}

function getJsonArrayCandidate(reply: string) {
    const trimmed = reply.trim();
    const withoutFence = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    const start = withoutFence.indexOf("[");
    const end = withoutFence.lastIndexOf("]");

    if (start >= 0 && end > start) {
        return withoutFence.slice(start, end + 1);
    }

    return withoutFence;
}

function parseLooseAssistantArray(reply: string): AssistantResponse | null {
    const candidate = getJsonArrayCandidate(reply);
    const match = candidate.match(/^\[\s*["'](answer|question)["']\s*,\s*([\s\S]*)\]\s*$/i);

    if (!match) return null;

    const responseType = match[1].toLowerCase();
    const rawParts = match[2].trim();
    const parts = Array.from(rawParts.matchAll(/["']([\s\S]*?)["'](?=\s*,|\s*$)/g))
        .map((part) => part[1].trim())
        .filter(Boolean);

    if (responseType === "question") {
        return {
            type: "question",
            questions: parts.length > 0 ? parts : ["Can you clarify what you mean?"],
        };
    }

    return {
        type: "answer",
        content: parts.join("\n\n") || "(empty response)",
    };
}

function parseAssistantResponse(reply: string): AssistantResponse {
    try {
        const parsed = JSON.parse(getJsonArrayCandidate(reply));

        if (!Array.isArray(parsed) || typeof parsed[0] !== "string") {
            return { type: "answer", content: reply };
        }

        const responseType = parsed[0].toLowerCase();
        const parts = parsed.slice(1).map((item) => String(item).trim()).filter(Boolean);

        if (responseType === "question") {
            return {
                type: "question",
                questions: parts.length > 0 ? parts : ["Can you clarify what you mean?"],
            };
        }

        if (responseType === "answer") {
            return {
                type: "answer",
                content: parts.join("\n\n") || "(empty response)",
            };
        }
    } catch {
        return parseLooseAssistantArray(reply) ?? { type: "answer", content: reply };
    }

    return { type: "answer", content: reply };
}

function buildQuestionAnswerMessage(answers: QuestionAnswer[]) {
    return [
        "Here are my answers to your clarifying questions:",
        "",
        ...answers.map((item, index) => {
            const answer = item.skipped ? "Skipped" : item.answer;

            return `Q${index + 1}: ${item.question}\nA${index + 1}: ${answer}`;
        }),
    ].join("\n");
}

function getAssistantHistoryContent(message: Message) {
    const response = message.response ?? parseAssistantResponse(message.content);

    if (response.type === "answer") {
        return response.content;
    }

    return [
        "Clarifying questions asked:",
        ...response.questions.map((question, index) => `${index + 1}. ${question}`),
    ].join("\n");
}

function buildChatHistory(messages: Message[]): ChatHistoryMessage[] {
    return messages
        .filter((message) => message.content.trim() || message.role === "assistant")
        .map((message) => ({
            role: message.role,
            content: message.role === "assistant" ? getAssistantHistoryContent(message) : message.content,
        }));
}

export default function ChatArea({ provider, model }: ChatAreaProps) {
    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [messageResponding, setMessageResponding] = useState(false);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 120) + "px";
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
    };

    const submitUserMessage = async (rawText: string, fileName?: string) => {
        const text = rawText.trim();
        if (!text && !fileName) return;
        setMessageResponding(true);

        const userMsg: Message = {
            id: Date.now(),
            role: "user",
            content: rawText,
            file: fileName,
            time: now(),
        };
        const nextMessages = [...messages, userMsg];
        setMessages((prev) => [...prev, userMsg]);

        if (!text) {
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: "assistant",
                    content: "File uploads aren't connected to chat yet. Add a message to continue.",
                    time: now(),
                },
            ]);
            setMessageResponding(false);
            return;
        }

        setIsTyping(true);
        try {
            const selectedProvider = provider ?? "DeepSeek";
            const apiKey = getSavedKeyForProvider(selectedProvider);
            const response = await sendChatMessage({
                message: rawText,
                history: buildChatHistory(nextMessages),
                model: model ?? undefined,
                provider: selectedProvider,
                apiKey: apiKey ?? undefined,
            });
            const reply = response.reply || "(empty response)";
            const parsedReply = parseAssistantResponse(reply);

            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: "assistant",
                    content: parsedReply.type === "answer" ? parsedReply.content : reply,
                    response: parsedReply,
                    time: now(),
                },
            ]);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: "assistant",
                    content: `Request failed: ${message}`,
                    time: now(),
                },
            ]);
        } finally {
            setIsTyping(false);
            setMessageResponding(false);
        }
    };

    const sendMessage = async () => {
        const rawText = input;
        const fileName = file?.name;

        if (!rawText.trim() && !fileName) return;

        setInput("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (textareaRef.current) textareaRef.current.style.height = "auto";

        await submitUserMessage(rawText, fileName);
    };

    const sendQuestionAnswers = async (answers: QuestionAnswer[]) => {
        await submitUserMessage(buildQuestionAnswerMessage(answers));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // derived boolean — disable sending while a response is being generated
    const canSend = !messageResponding && (input.trim().length > 0 || !!file)

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-6 space-y-7 scroll-smooth">
                {messages.map((msg) => {
                    if (msg.role === "assistant") {
                        const response = msg.response ?? parseAssistantResponse(msg.content);

                        return (
                            <div key={msg.id} className="w-full">
                                <div className="max-w-[76%]">
                                    <div className="text-[15px] leading-7 text-foreground text-left">
                                        {response.type === "question" ? (
                                            <QuestionChat
                                                questions={response.questions}
                                                disabled={messageResponding}
                                                onComplete={sendQuestionAnswers}
                                            />
                                        ) : (
                                            <ResponseChat content={response.content} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div key={msg.id} className={`flex items-end gap-2.5 flex-row-reverse`}>

                            <div className={`flex flex-col gap-1 max-w-[72%] items-end`}>
                                {msg.file && (
                                    <div className="inline-flex items-center gap-1.5 bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground">
                                        {msg.file}
                                    </div>
                                )}

                                {msg.content && (
                                    <div className={`whitespace-pre-wrap break-words px-3.5 py-2.5 rounded-[10px] text-sm leading-relaxed bg-foreground text-background`}>
                                        {msg.content}
                                    </div>
                                )}

                                {/* timestamp removed */}
                            </div>
                        </div>
                    )
                })}

                {isTyping && (
                    <div className="flex items-end gap-2.5">
                        <div className="size-7 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
                            <Bot className="size-3.5" />
                        </div>
                        <div className="bg-muted border border-border/40 rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-1">
                            {[0, 150, 300].map((delay) => (
                                <span
                                    key={delay}
                                    className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                                    style={{ animationDelay: `${delay}ms` }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <div className="border-t border-border/60 p-3 bg-background/80 backdrop-blur shrink-0">
                <div className="rounded-xl border border-border/60 bg-muted/40 focus-within:border-border transition-colors overflow-hidden">
                    {file && (
                        <div className="flex items-center gap-1.5 w-fit bg-background border border-border/60 rounded-lg px-2.5 py-1.5">
                            <File className="size-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground max-w-[180px] truncate">
                                {file.name}
                            </span>
                            <button
                                onClick={() => {
                                    setFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                                className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            autoResize();
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Message PekHu AI..."
                        rows={1}
                        className="w-full bg-transparent resize-none outline-none px-3.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground leading-relaxed min-h-[40px] max-h-[120px]"
                    />

                    <div className="flex items-center gap-1 px-2 pb-2.5 pt-1">
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                            title="Attach file"
                        >
                            <Paperclip className="size-3.5" />
                        </button>
                        <button
                            className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                            title="Emoji"
                        >
                            <Smile className="size-3.5" />
                        </button>
                        <button
                            className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                            title="Voice message"
                        >
                            <Mic className="size-3.5" />
                        </button>

                        <div className="flex-1" />

                        <button
                            onClick={sendMessage}
                            disabled={!canSend}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-30 hover:opacity-80 transition-opacity"
                        >
                            Send
                            <Send className="size-3" />
                        </button>
                    </div>
                </div>

                <p className="text-center text-[10px] text-muted-foreground mt-2">
                    PekHu AI can make mistakes. Verify important info.
                </p>
            </div>
        </div>
    );
}
