import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Send, Paperclip, Smile, Mic, X, Bot, File } from "lucide-react";
import { sendChatMessage } from "../data/chatApi";
import { type Provider } from "../data/api";

interface Message {
    id: number;
    role: "user" | "assistant";
    content: string;
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

    const sendMessage = async () => {
        const text = input.trim();
        if (!text && !file) return;
        setMessageResponding(true);

        const userMsg: Message = {
            id: Date.now(),
            role: "user",
            content: text,
            file: file?.name,
            time: now(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (textareaRef.current) textareaRef.current.style.height = "auto";

        if (provider && provider !== "DeepSeek") {
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: "assistant",
                    content: "Only DeepSeek is wired right now. Switch the provider to DeepSeek to chat.",
                    time: now(),
                },
            ]);
            setMessageResponding(false);
            return;
        }

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
            const apiKey = getSavedKeyForProvider("DeepSeek");
            const response = await sendChatMessage({
                message: text,
                model: model ?? undefined,
                apiKey: apiKey ?? undefined,
            });

            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: "assistant",
                    content: response.reply || "(empty response)",
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
            <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-5 space-y-4 scroll-smooth">
                {messages.map((msg) => {
                    if (msg.role === "assistant") {
                        return (
                            <div key={msg.id} className="w-full">
                                <div className="max-w-[72%]">
                                    <div className="text-sm leading-relaxed text-foreground text-left">
                                        {msg.content}
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
                                    <div className={`px-3.5 py-2.5 rounded-[10px] text-sm leading-relaxed bg-foreground text-background`}>
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
