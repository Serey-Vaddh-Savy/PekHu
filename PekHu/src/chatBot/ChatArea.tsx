import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { Send, Paperclip, Smile, Mic, X, Bot, File, Plus, ChevronDown } from "lucide-react";
import { sendChatMessage, type ChatHistoryMessage } from "../../backend/chatApi";
import { type Provider } from "../data/api";
import ResponseChat from "./ResponseChat";
import QuestionChat, { type QuestionAnswer } from "./QuestionChat";

type SingleAssistantResponse =
    | { type: "answer"; content: string }
    | { type: "question"; questions: string[] }
    | { type: "delegate"; delegateTask: string[] };

type AssistantResponse =
    | SingleAssistantResponse
    | { type: "multi"; responses: SingleAssistantResponse[] };

export type DelegatePayload = {
    provider: string;
    task: string;
    attachedFile: string;
};

export interface Message {
    id: number;
    role: "user" | "assistant";
    content: string;
    response?: AssistantResponse;
    file?: string;
    time: string;
}

const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const CHAT_TEXTAREA_MAX_HEIGHT = 250;
const DELEGATED_RETURN_PREFIX = "Delegated AI response received.";
const DELEGATED_RETURN_LABEL = "Delegated response received";

export const INITIAL_MESSAGES: Message[] = [
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
    messages: Message[];
    setMessages: Dispatch<SetStateAction<Message[]>>;
    pendingContext?: string;
    onPendingContextSent?: () => void;
    onDelegateResponse?: (delegate: DelegatePayload) => void;
    externalResponding?: boolean;
}

export function createInitialMessages() {
    return INITIAL_MESSAGES.map((message) => ({ ...message }));
}

export function getSavedKeyForProvider(provider: Provider | null): string | null {
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

function stripJsonFence(reply: string) {
    const trimmed = reply.trim();

    return trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

function getJsonArrayCandidate(reply: string) {
    const withoutFence = stripJsonFence(reply);
    const start = withoutFence.indexOf("[");
    const end = withoutFence.lastIndexOf("]");

    if (start >= 0 && end > start) {
        return withoutFence.slice(start, end + 1);
    }

    return withoutFence;
}

const responseTypes = ["answer", "question", "delegate"] as const;
type ResponseType = typeof responseTypes[number];

function isResponseType(value: string): value is ResponseType {
    return responseTypes.includes(value as ResponseType);
}

function isAllowedMultiResponse(responses: SingleAssistantResponse[]) {
    if (responses.length !== 2) {
        return false;
    }

    const types = responses.map((response) => response.type);
    const hasAnswer = types.includes("answer");
    const hasDelegate = types.includes("delegate");
    const hasQuestion = types.includes("question");

    return hasAnswer && (hasDelegate || hasQuestion) && !(hasDelegate && hasQuestion);
}

function parseSingleAssistantArray(value: unknown): SingleAssistantResponse | null {
    if (!Array.isArray(value) || typeof value[0] !== "string") {
        return null;
    }

    const responseType = value[0].toLowerCase();
    if (!isResponseType(responseType)) {
        return null;
    }

    const parts = value.slice(1).map((item) => String(item).trim()).filter(Boolean);

    if (responseType === "question") {
        return {
            type: "question",
            questions: parts.length > 0 ? parts : ["Can you clarify what you mean?"],
        };
    }

    if (responseType === "delegate") {
        return {
            type: "delegate",
            delegateTask: parts.length < 3 ? [] : parts,
        };
    }

    return {
        type: "answer",
        content: parts.join("\n\n") || "(empty response)",
    };
}

function parseAssistantArray(value: unknown): AssistantResponse | null {
    const singleResponse = parseSingleAssistantArray(value);
    if (singleResponse) {
        return singleResponse;
    }

    if (!Array.isArray(value) || value.length === 0) {
        return null;
    }

    const responses = value.map(parseSingleAssistantArray);
    if (responses.some((response) => response == null)) {
        return null;
    }

    const validResponses = responses as SingleAssistantResponse[];
    if (validResponses.length === 1) {
        return validResponses[0];
    }

    return isAllowedMultiResponse(validResponses) ? { type: "multi", responses: validResponses } : null;
}

function extractTopLevelJsonArrays(reply: string) {
    const source = stripJsonFence(reply);
    const arrays: string[] = [];
    let depth = 0;
    let start = -1;
    let quote: string | null = null;
    let escaped = false;

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === "\"" || char === "'") {
            quote = char;
            continue;
        }

        if (char === "[") {
            if (depth === 0) {
                start = index;
            }
            depth += 1;
            continue;
        }

        if (char === "]" && depth > 0) {
            depth -= 1;
            if (depth === 0 && start >= 0) {
                arrays.push(source.slice(start, index + 1));
                start = -1;
            }
        }
    }

    return arrays;
}

function parseLooseAssistantArray(reply: string): SingleAssistantResponse | null {
    const candidate = getJsonArrayCandidate(reply);
    const match = candidate.match(/^\[\s*["'](answer|question|delegate)["']\s*,\s*([\s\S]*)\]\s*$/i);

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

    if (responseType === "delegate") {
        return {
            type: "delegate",
            delegateTask: parts.length < 3 ? [] : parts,
        };
    }

    return {
        type: "answer",
        content: parts.join("\n\n") || "(empty response)",
    };
}

export function parseAssistantResponse(reply: string): AssistantResponse {
    try {
        const parsed = JSON.parse(getJsonArrayCandidate(reply));
        const response = parseAssistantArray(parsed);

        if (response) {
            return response;
        }
    } catch {
        // Fall through to loose parsing.
    }

    const topLevelArrays = extractTopLevelJsonArrays(reply);
    if (topLevelArrays.length > 1) {
        const responses = topLevelArrays.map((candidate) => {
            try {
                return parseSingleAssistantArray(JSON.parse(candidate));
            } catch {
                return parseLooseAssistantArray(candidate);
            }
        });

        if (responses.every((response) => response != null)) {
            const validResponses = responses as SingleAssistantResponse[];
            if (isAllowedMultiResponse(validResponses)) {
                return { type: "multi", responses: validResponses };
            }
        }
    }

    const looseSingleResponse = parseLooseAssistantArray(reply);
    if (looseSingleResponse) {
        return looseSingleResponse;
    }

    return { type: "answer", content: reply };
}

export function getAssistantResponseItems(response: AssistantResponse): SingleAssistantResponse[] {
    return response.type === "multi" ? response.responses : [response];
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

export function getDelegatePayload(delegateTask: string[]): DelegatePayload | null {
    if (delegateTask.length < 3) {
        return null;
    }

    const [provider, task, ...attachedFiles] = delegateTask;

    return {
        provider,
        task,
        attachedFile: attachedFiles.join("\n"),
    };
}

function getDelegatePayloads(response: AssistantResponse) {
    return getAssistantResponseItems(response)
        .filter((item) => item.type === "delegate")
        .map((item) => getDelegatePayload(item.delegateTask))
        .filter((item): item is DelegatePayload => item != null);
}

function formatDelegateTask(delegateTask: string[]) {
    const delegate = getDelegatePayload(delegateTask);

    if (!delegate) {
        return "Delegation requested, but the response was missing provider, task, or file context.";
    }

    return [
        "Delegation requested:",
        `Provider: ${delegate.provider}`,
        `Task: ${delegate.task}`,
        `Attached file/context: ${delegate.attachedFile}`,
    ].join("\n");
}

function DelegateChat({
    delegateTask,
    onOpen,
}: {
    delegateTask: string[];
    onOpen?: (delegate: DelegatePayload) => void;
}) {
    const delegate = getDelegatePayload(delegateTask);

    if (!delegate) {
        return <ResponseChat content={formatDelegateTask(delegateTask)} />;
    }

    return (
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/35 p-3 text-sm text-foreground">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-medium uppercase text-muted-foreground">Delegation requested</div>
                    <div className="mt-1 truncate font-medium">{delegate.provider}</div>
                </div>
                <button
                    type="button"
                    onClick={() => onOpen?.(delegate)}
                    disabled={!onOpen}
                    className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-40"
                >
                    <Plus className="size-3.5" />
                    <span>Review</span>
                </button>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap leading-relaxed">{delegate.task}</p>
        </div>
    );
}

function formatSingleAssistantResponseContent(response: SingleAssistantResponse) {
    if (response.type === "answer") {
        return response.content;
    }

    if (response.type === "question") {
        return [
            "Clarifying questions asked:",
            ...response.questions.map((question, index) => `${index + 1}. ${question}`),
        ].join("\n");
    }

    if (response.type === "delegate") {
        return formatDelegateTask(response.delegateTask);
    }

    return "Response had an unsupported format.";
}

function formatAssistantResponseContent(response: AssistantResponse) {
    const responseItems = getAssistantResponseItems(response);

    return responseItems
        .map((item, index) => {
            const content = formatSingleAssistantResponseContent(item);

            return responseItems.length > 1 ? `Response ${index + 1}:\n${content}` : content;
        })
        .join("\n\n");
}

function getAssistantHistoryContent(message: Message) {
    const response = message.response ?? parseAssistantResponse(message.content);

    return formatAssistantResponseContent(response);
}

function isDelegatedReturnMessage(content: string) {
    return content.trimStart().startsWith(DELEGATED_RETURN_PREFIX);
}

export function buildChatHistory(messages: Message[]): ChatHistoryMessage[] {
    return messages
        .filter((message) => message.content.trim() || message.role === "assistant")
        .map((message) => ({
            role: message.role,
            content: message.role === "assistant" ? getAssistantHistoryContent(message) : message.content,
        }));
}

export default function ChatArea({
    provider,
    model,
    messages,
    setMessages,
    pendingContext,
    onPendingContextSent,
    onDelegateResponse,
    externalResponding = false,
}: ChatAreaProps) {
    const [input, setInput] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [messageResponding, setMessageResponding] = useState(false);
    const [expandedDelegatedMessageIds, setExpandedDelegatedMessageIds] = useState<Set<number>>(() => new Set());

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping, externalResponding]);

    const autoResize = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, CHAT_TEXTAREA_MAX_HEIGHT) + "px";
        el.style.overflowY = el.scrollHeight > CHAT_TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
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
            const hiddenContextMessage: Message | null = pendingContext?.trim()
                ? {
                    id: Date.now() - 1,
                    role: "user",
                    content: pendingContext,
                    time: now(),
                }
                : null;
            const historyMessages = hiddenContextMessage
                ? [...messages, hiddenContextMessage, userMsg]
                : nextMessages;
            const response = await sendChatMessage({
                message: rawText,
                history: buildChatHistory(historyMessages),
                model: model ?? undefined,
                provider: selectedProvider,
                apiKey: apiKey ?? undefined,
            });
            const reply = response.reply || "(empty response)";
            const parsedReply = parseAssistantResponse(reply);
            const assistantContent = formatAssistantResponseContent(parsedReply);
            const firstDelegate = getDelegatePayloads(parsedReply)[0];
            onPendingContextSent?.();

            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: "assistant",
                    content: assistantContent,
                    response: parsedReply,
                    time: now(),
                },
            ]);
            if (firstDelegate) {
                onDelegateResponse?.(firstDelegate);
            }
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
        if (!canSend) return;

        const rawText = input;
        const fileName = file?.name;

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

    const toggleDelegatedMessage = (messageId: number) => {
        setExpandedDelegatedMessageIds((ids) => {
            const nextIds = new Set(ids);

            if (nextIds.has(messageId)) {
                nextIds.delete(messageId);
            } else {
                nextIds.add(messageId);
            }

            return nextIds;
        });
    };

    // derived boolean — disable sending while a response is being generated
    const isResponding = messageResponding || externalResponding;
    const canSend = !isResponding && (input.trim().length > 0 || !!file);

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-6 space-y-7 scroll-smooth">
                {messages.map((msg) => {
                    if (msg.role === "assistant") {
                        const response = msg.response ?? parseAssistantResponse(msg.content);
                        const responseItems = getAssistantResponseItems(response);

                        return (
                            <div key={msg.id} className="w-full">
                                <div className="max-w-[76%]">
                                    <div className="space-y-5 text-left text-[15px] leading-7 text-foreground">
                                        {responseItems.map((item, index) => (
                                            <div key={`${msg.id}-response-${index}`}>
                                                {item.type === "question" ? (
                                                    <QuestionChat
                                                        questions={item.questions}
                                                        disabled={isResponding}
                                                        onComplete={sendQuestionAnswers}
                                                    />
                                                ) : item.type === "answer" ? (
                                                    <ResponseChat content={item.content} />
                                                ) : (
                                                    <DelegateChat
                                                        delegateTask={item.delegateTask}
                                                        onOpen={onDelegateResponse}
                                                    />
                                                )}
                                            </div>
                                        ))}
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
                                    isDelegatedReturnMessage(msg.content) ? (
                                        <button
                                            type="button"
                                            onClick={() => toggleDelegatedMessage(msg.id)}
                                            aria-expanded={expandedDelegatedMessageIds.has(msg.id)}
                                            className="max-w-full rounded-[10px] border border-sky-200 bg-sky-100 px-3.5 py-2.5 text-left text-sm leading-relaxed text-sky-950 transition-colors hover:bg-sky-200/70"
                                        >
                                            <span className="flex items-center gap-2 font-medium">
                                                <span>{DELEGATED_RETURN_LABEL}</span>
                                                <ChevronDown
                                                    className={[
                                                        "size-4 shrink-0 transition-transform",
                                                        expandedDelegatedMessageIds.has(msg.id) ? "rotate-180" : "",
                                                    ].join(" ")}
                                                />
                                            </span>
                                            {expandedDelegatedMessageIds.has(msg.id) && (
                                                <span className="mt-3 block whitespace-pre-wrap break-words border-t border-sky-200 pt-3 font-normal">
                                                    {msg.content}
                                                </span>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="whitespace-pre-wrap break-words rounded-[10px] border border-sky-200 bg-sky-100 px-3.5 py-2.5 text-sm leading-relaxed text-sky-950">
                                            {msg.content}
                                        </div>
                                    )
                                )}

                                {/* timestamp removed */}
                            </div>
                        </div>
                    )
                })}

                {(isTyping || externalResponding) && (
                    <div className="flex items-end gap-2.5">
                        <div className="size-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
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

            <div className="p-3 shrink-0">
                <div className="rounded-xl border border-border/60 bg-background shadow-sm focus-within:border-border transition-colors overflow-hidden">
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
                        className="thin-scrollbar w-full bg-transparent resize-none outline-none px-3.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground leading-relaxed min-h-[40px] max-h-[300px] overflow-y-hidden"
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
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-sky-600 text-white text-xs font-medium disabled:opacity-30 hover:bg-sky-700 transition-colors"
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
