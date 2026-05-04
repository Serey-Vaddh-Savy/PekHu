import { useState, type Dispatch, type SetStateAction } from "react";
import {
    Bot,
    CheckCircle2,
    FileText,
    FolderOpen,
    KeyRound,
    MessageSquare,
    PanelLeft,
    Plus,
    Sparkles,
    Trash2,
} from "lucide-react";
import { sendChatMessage } from "../../backend/chatApi";
import ChatArea, {
    buildChatHistory,
    createInitialMessages,
    getSavedKeyForProvider,
    parseAssistantResponse,
    type Message,
} from "./ChatArea";
import ApiKey from "./ApiKey";
import { API_PROVIDERS, PROVIDER_COLORS, PROVIDER_MODELS, type Provider, type ProviderModel } from "../data/api";
import { AlertToast } from "../components/ui/alert-toast";
import {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxList,
} from "../components/ui/combobox";


const footerPageOptions = [
    { label: "API Key", icon: KeyRound, value: "apikey" },
    { label: "ChatBot", icon: MessageSquare, value: "chatbot" },
];

const formatOutputPrice = (outputPer1M: number | null) =>
    outputPer1M == null ? "Pricing unavailable" : `$${outputPer1M.toFixed(2)} / 1M output tokens`;

const formatSelectedOutputPrice = (outputPer1M: number | null) =>
    outputPer1M == null ? "Pricing unavailable" : `$${outputPer1M.toFixed(2)}`;

const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

type PendingModel = ProviderModel & {
    provider: Provider;
};

type ChatMini = {
    id: string;
    title: string;
    messages: Message[];
    summary?: string;
    summaryAdded?: boolean;
    isSummarizing?: boolean;
};

type ActiveChat =
    | { type: "master" }
    | { type: "mini"; id: string };

function resolveMessages(value: SetStateAction<Message[]>, current: Message[]) {
    return typeof value === "function" ? (value as (messages: Message[]) => Message[])(current) : value;
}

function hasConversation(messages: Message[]) {
    return messages.some((message) => message.id !== 1 && (message.content.trim() || message.file));
}

function getSummaryContent(reply: string) {
    const parsedReply = parseAssistantResponse(reply);

    if (parsedReply.type === "answer") {
        return parsedReply.content;
    }

    return parsedReply.questions.join("\n");
}

function getMiniTranscript(mini: ChatMini) {
    const history = buildChatHistory(mini.messages.filter((message) => message.id !== 1));

    return history
        .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
        .join("\n\n");
}

function Chatbot() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activePage, setActivePage] = useState("chatbot");
    const [provider, setProvider] = useState<Provider | null>(null);
    const [model, setModel] = useState<string | null>(null);
    const [showModelsFor, setShowModelsFor] = useState<Provider | null>(null);
    const [comboboxOpen, setComboboxOpen] = useState(false);
    const [chatKey, setChatKey] = useState(0);
    const [pendingModel, setPendingModel] = useState<PendingModel | null>(null);
    const [chatMaster, setChatMaster] = useState<Message[]>(() => createInitialMessages());
    const [chatMinis, setChatMinis] = useState<ChatMini[]>([]);
    const [activeChat, setActiveChat] = useState<ActiveChat>({ type: "master" });
    const [contextPickerOpen, setContextPickerOpen] = useState(false);
    const [selectedMiniContextIds, setSelectedMiniContextIds] = useState<string[]>([]);
    const [pendingMasterContext, setPendingMasterContext] = useState("");
    const [pendingMasterContextTitles, setPendingMasterContextTitles] = useState<string[]>([]);

    const activeMini = activeChat.type === "mini"
        ? chatMinis.find((mini) => mini.id === activeChat.id)
        : undefined;
    const activeMessages = activeChat.type === "master" ? chatMaster : activeMini?.messages ?? createInitialMessages();
    const activeTitle = activeChat.type === "master" ? "Master Context" : activeMini?.title ?? "Mini chat";
    const miniSummaries = chatMinis.filter((mini) => mini.summary);
    const minisWithContext = chatMinis.filter((mini) => hasConversation(mini.messages));

    const setActiveMiniMessages: Dispatch<SetStateAction<Message[]>> = (value) => {
        if (activeChat.type !== "mini") return;

        setChatMinis((minis) =>
            minis.map((mini) =>
                mini.id === activeChat.id
                    ? {
                        ...mini,
                        messages: resolveMessages(value, mini.messages),
                        summaryAdded: false,
                    }
                    : mini,
            ),
        );
    };

    const setActiveMessages: Dispatch<SetStateAction<Message[]>> =
        activeChat.type === "master" ? setChatMaster : setActiveMiniMessages;

    const handleNewChat = () => {
        setChatKey((k) => k + 1);
        setChatMaster(createInitialMessages());
        setChatMinis([]);
        setActiveChat({ type: "master" });
        setContextPickerOpen(false);
        setSelectedMiniContextIds([]);
        setPendingMasterContext("");
        setPendingMasterContextTitles([]);
        setProvider(null);
        setModel(null);
        setShowModelsFor(null);
        setComboboxOpen(false);
        setPendingModel(null);
    };

    const clearModel = () => {
        setProvider(null);
        setModel(null);
        setShowModelsFor(null);
        setPendingModel(null);
    };

    const handleCreateMiniChat = () => {
        const id = `mini-${Date.now()}`;
        const title = `Mini chat ${chatMinis.length + 1}`;

        setChatMinis((minis) => [
            ...minis,
            {
                id,
                title,
                messages: createInitialMessages(),
            },
        ]);
        setContextPickerOpen(false);
        setActiveChat({ type: "mini", id });
    };

    const deleteMiniChat = (miniId: string) => {
        setChatMinis((minis) => minis.filter((mini) => mini.id !== miniId));
        setSelectedMiniContextIds((ids) => ids.filter((id) => id !== miniId));

        if (activeChat.type === "mini" && activeChat.id === miniId) {
            setActiveChat({ type: "master" });
            setChatKey((k) => k + 1);
        }
    };

    const generateMiniSummary = async (miniId: string) => {
        const mini = chatMinis.find((item) => item.id === miniId);
        if (!mini || !hasConversation(mini.messages)) return;

        setChatMinis((minis) =>
            minis.map((item) => item.id === miniId ? { ...item, isSummarizing: true } : item),
        );

        try {
            const selectedProvider = provider ?? "DeepSeek";
            const apiKey = getSavedKeyForProvider(selectedProvider);
            const response = await sendChatMessage({
                message: "Summarize this mini chat for adding into the main chat context. Return concise plain text only.",
                history: buildChatHistory(mini.messages),
                model: model ?? undefined,
                provider: selectedProvider,
                apiKey: apiKey ?? undefined,
            });
            const summary = getSummaryContent(response.reply || "(empty summary)");

            setChatMinis((minis) =>
                minis.map((item) =>
                    item.id === miniId
                        ? {
                            ...item,
                            summary,
                            summaryAdded: false,
                            isSummarizing: false,
                        }
                        : item,
                ),
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";

            setChatMinis((minis) =>
                minis.map((item) =>
                    item.id === miniId
                        ? {
                            ...item,
                            summary: `Summary failed: ${message}`,
                            summaryAdded: false,
                            isSummarizing: false,
                        }
                        : item,
                ),
            );
        }
    };

    const addMiniSummaryToMaster = (mini: ChatMini) => {
        if (!mini.summary) return;

        setChatMaster((messages) => [
            ...messages,
            {
                id: Date.now(),
                role: "user",
                content: `Context from ${mini.title}:\n\n${mini.summary}`,
                time: now(),
            },
        ]);
        setChatMinis((minis) =>
            minis.map((item) => item.id === mini.id ? { ...item, summaryAdded: true } : item),
        );
        setActiveChat({ type: "master" });
    };

    const toggleMiniContextSelection = (miniId: string) => {
        setSelectedMiniContextIds((ids) =>
            ids.includes(miniId) ? ids.filter((id) => id !== miniId) : [...ids, miniId],
        );
    };

    const selectAllMiniContexts = () => {
        setSelectedMiniContextIds(minisWithContext.map((mini) => mini.id));
    };

    const clearMiniContextSelection = () => {
        setSelectedMiniContextIds([]);
    };

    const addSelectedMiniContextsToMaster = () => {
        const selectedMinis = chatMinis.filter((mini) => selectedMiniContextIds.includes(mini.id));
        const contextBlocks = selectedMinis
            .map((mini) => {
                const transcript = getMiniTranscript(mini);

                return transcript ? `## ${mini.title}\n${transcript}` : "";
            })
            .filter(Boolean);

        if (contextBlocks.length === 0) return;

        setPendingMasterContext(`Full context from selected mini chats:\n\n${contextBlocks.join("\n\n---\n\n")}`);
        setPendingMasterContextTitles(selectedMinis.map((mini) => mini.title));
        setSelectedMiniContextIds([]);
        setContextPickerOpen(false);
    };

    const clearPendingMasterContext = () => {
        setPendingMasterContext("");
        setPendingMasterContextTitles([]);
    };

    const onChangeModel = (selectedProvider: Provider, selectedModel: ProviderModel) => {
        if (!model) {
            setProvider(selectedProvider);
            setModel(selectedModel.id);
            setShowModelsFor(null);
            setComboboxOpen(false);
            return;
        }

        if (provider === selectedProvider && model === selectedModel.id) {
            setShowModelsFor(null);
            setComboboxOpen(false);
            return;
        }

        setPendingModel({ provider: selectedProvider, ...selectedModel });
        setShowModelsFor(null);
        setComboboxOpen(false);
    };

    const confirmPendingModel = () => {
        if (!pendingModel) return;

        setProvider(pendingModel.provider);
        setModel(pendingModel.id);
        setPendingModel(null);
    };

    const cancelPendingModel = () => {
        setPendingModel(null);
    };

    const selectedModelPrice =
        provider && model
            ? PROVIDER_MODELS[provider].find((providerModel) => providerModel.id === model)?.outputPer1M ?? null
            : null;

    const selectedModelLabel =
        provider && model
            ? `${model} - ${formatSelectedOutputPrice(selectedModelPrice)}`
            : "";

    const modelChangeAlertToast = () => (
        <AlertToast
            open={pendingModel != null}
            title="Change to this model?"
            description={
                pendingModel
                    ? `${pendingModel.id} - ${formatOutputPrice(pendingModel.outputPer1M)}. \n All chat in this window will be re-process, it will cost extra.`
                    : undefined
            }
            confirmLabel="Change Model"
            cancelLabel="Cancel"
            onConfirm={confirmPendingModel}
            onCancel={cancelPendingModel}
        />
    );

    const modelCombobox = (className = "w-56") => (
        <Combobox
            open={comboboxOpen}
            onOpenChange={setComboboxOpen}
            onValueChange={(v) => {
                if (!v) clearModel();
            }}
        >
            <ComboboxInput
                placeholder={model ? `${provider} - ${model}` : "Select model"}
                value={selectedModelLabel}
                readOnly
                showTrigger
                showClear
                className={className}
            />

            <ComboboxContent side="bottom" align="end">
                {showModelsFor == null ? (
                    <ComboboxList>
                        {API_PROVIDERS.map((p) => (
                            <li key={p} className="list-none">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded"
                                    onClick={() => {
                                        setShowModelsFor(p);
                                        setComboboxOpen(true);
                                    }}
                                >
                                    <span className={["inline-block w-2 h-2 rounded-full", PROVIDER_COLORS[p]].join(" ")}></span>
                                    <span className="truncate">{p}</span>
                                </button>
                            </li>
                        ))}
                    </ComboboxList>
                ) : (
                    <div>
                        <div className="flex items-center justify-between px-3 py-2 border-b">
                            <button
                                type="button"
                                className="text-sm text-muted-foreground"
                                onClick={() => setShowModelsFor(null)}
                            >
                                Back
                            </button>
                            <div className="text-sm font-medium">{showModelsFor}</div>
                        </div>
                        <ul className="max-h-[12.25rem] overflow-y-auto overscroll-contain p-1">
                            {PROVIDER_MODELS[showModelsFor].map((m) => (
                                <li key={m.id} className="list-none">
                                    <button
                                        type="button"
                                        className="flex h-14 w-full flex-col items-start justify-center gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                                        onClick={() => onChangeModel(showModelsFor, m)}
                                    >
                                        <span className="w-full truncate font-medium">{m.id}</span>
                                        <span className="w-full truncate text-xs text-muted-foreground">
                                            {formatOutputPrice(m.outputPer1M)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </ComboboxContent>
        </Combobox>
    );

    const recentChatList = () => (
        <div className="space-y-1">
            <button
                type="button"
                onClick={() => setActiveChat({ type: "master" })}
                className={[
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    activeChat.type === "master"
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/70",
                ].join(" ")}
            >
                {chatMinis.length > 0 ? (
                    <FolderOpen className="size-4 shrink-0 opacity-70" />
                ) : (
                    <MessageSquare className="size-4 shrink-0 opacity-70" />
                )}
                <span className="min-w-0 flex-1 truncate text-left">Chat master</span>
            </button>

            {chatMinis.length > 0 && (
                <div className="ml-4 space-y-1 border-l border-sidebar-border/70 pl-2">
                    <button
                        type="button"
                        onClick={() => setActiveChat({ type: "master" })}
                        className={[
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                            activeChat.type === "master"
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/70",
                        ].join(" ")}
                    >
                        <MessageSquare className="size-4 shrink-0 opacity-70" />
                        <span className="min-w-0 flex-1 truncate text-left">Master context</span>
                    </button>

                    {chatMinis.map((mini) => (
                        <div
                            key={mini.id}
                            className={[
                                "flex items-center rounded-lg transition-colors",
                                activeChat.type === "mini" && activeChat.id === mini.id
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent/70",
                            ].join(" ")}
                        >
                            <button
                                type="button"
                                onClick={() => setActiveChat({ type: "mini", id: mini.id })}
                                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-sm"
                            >
                                <FileText className="size-4 shrink-0 opacity-70" />
                                <span className="min-w-0 flex-1 truncate text-left">{mini.title}</span>
                                {mini.summary && <Sparkles className="size-3.5 shrink-0 opacity-70" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => deleteMiniChat(mini.id)}
                                title={`Delete ${mini.title}`}
                                className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-background/70 hover:text-foreground"
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const headerActions = activePage === "chatbot" && model && (
        <div className="ml-auto flex items-center gap-2">
            {activeChat.type === "master" ? (
                <>
                    <button
                        type="button"
                        onClick={() => setContextPickerOpen((open) => !open)}
                        disabled={minisWithContext.length === 0}
                        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm transition-colors hover:bg-muted disabled:opacity-40"
                    >
                        <FileText className="size-4" />
                        <span className="hidden sm:inline">Add context</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateMiniChat}
                        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm transition-colors hover:bg-muted"
                    >
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">Mini chat</span>
                    </button>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={() => activeMini && generateMiniSummary(activeMini.id)}
                        disabled={!activeMini || activeMini.isSummarizing || !hasConversation(activeMini.messages)}
                        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm transition-colors hover:bg-muted disabled:opacity-40"
                    >
                        <Sparkles className="size-4" />
                        <span className="hidden sm:inline">
                            {activeMini?.isSummarizing ? "Summarizing" : "Summary"}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => activeMini && deleteMiniChat(activeMini.id)}
                        disabled={!activeMini}
                        title="Delete mini chat"
                        className="flex size-9 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted disabled:opacity-40"
                    >
                        <Trash2 className="size-4" />
                    </button>
                </>
            )}
            {modelCombobox()}
        </div>
    );

    return (
        <div className="flex h-svh bg-muted/30">
            <aside
                className={[
                    "flex flex-col bg-sidebar border-r border-sidebar-border/70 transition-all duration-200 overflow-hidden",
                    sidebarOpen ? "w-60 min-w-60 opacity-100" : "w-0 min-w-0 opacity-0",
                ].join(" ")}
            >
                <div className="flex flex-col gap-3 border-b border-sidebar-border/70 px-4 py-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shrink-0">
                            <Bot className="size-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-semibold tracking-tight truncate">PekHu AI</div>
                            <div className="text-xs text-sidebar-foreground/60 truncate">Your chat workspace</div>
                        </div>
                    </div>
                </div>

                
                <button onClick={handleNewChat} className="flex w-full  items-center gap-2 rounded-lg  bg-transparent px-3 py-2 text-sm hover:bg-background transition-colors mt-5 mb-5">
                    <Plus className="size-4 shrink-0" />
                    <span className="truncate">Start new chat</span>
                </button>
                <div className="flex-1 overflow-y-auto px-2 py-3">
                    <p className="px-2 pb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                        Recent
                    </p>
                    {recentChatList()}
                </div>

                <div className="border-t border-sidebar-border/70 p-3 shrink-0 h-[138px]">
                    <div className="rounded-lg bg-sidebar-accent/60 p-3">
                        <ul className="flex flex-col gap-0.5">
                            {footerPageOptions.map(({ label, icon: Icon, value }) => (
                                <li key={label}>
                                    <button
                                        className={[
                                            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                                            activePage === value
                                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                                : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                                        ].join(" ")}
                                        onClick={() => setActivePage(value)}
                                    >
                                        <Icon className="size-4 shrink-0 opacity-70" />
                                        <span className="truncate">{label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </aside>

            <div className="flex flex-1 flex-col overflow-hidden">
                <header className="flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur shrink-0">
                    <button
                        onClick={() => setSidebarOpen((o) => !o)}
                        className="flex size-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                        aria-label="Toggle sidebar"
                    >
                        <PanelLeft className="size-4" />
                    </button>
                    <span className="min-w-0 truncate text-sm font-medium">{activePage === "chatbot" ? activeTitle : "API Key"}</span>
                    {activePage === "apikey" && (
                        <h1 className="ml-auto text-sm font-medium"></h1>
                    )}
                    {headerActions}
                </header>

                {activePage === "chatbot" && model && activeChat.type === "master" && contextPickerOpen && (
                    <div className="shrink-0 border-b border-border/60 bg-background px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">Full mini context</span>
                            {minisWithContext.map((mini) => (
                                <label
                                    key={mini.id}
                                    className={[
                                        "flex h-8 max-w-56 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-xs transition-colors",
                                        selectedMiniContextIds.includes(mini.id)
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-border bg-background hover:bg-muted",
                                    ].join(" ")}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedMiniContextIds.includes(mini.id)}
                                        onChange={() => toggleMiniContextSelection(mini.id)}
                                        className="size-3.5 accent-current"
                                    />
                                    <span className="truncate">{mini.title}</span>
                                </label>
                            ))}
                            <div className="flex flex-1 justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={selectAllMiniContexts}
                                    disabled={minisWithContext.length === 0}
                                    className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-40"
                                >
                                    Select all
                                </button>
                                <button
                                    type="button"
                                    onClick={clearMiniContextSelection}
                                    disabled={selectedMiniContextIds.length === 0}
                                    className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-40"
                                >
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    onClick={addSelectedMiniContextsToMaster}
                                    disabled={selectedMiniContextIds.length === 0}
                                    className="h-8 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-30"
                                >
                                    Add selected
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activePage === "chatbot" && model && activeChat.type === "master" && pendingMasterContext && (
                    <div className="shrink-0 border-b border-border/60 bg-background px-4 py-2">
                        <div className="flex items-center gap-2">
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                Context staged for next message: {pendingMasterContextTitles.join(", ")}
                            </span>
                            <button
                                type="button"
                                onClick={clearPendingMasterContext}
                                className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs transition-colors hover:bg-muted"
                            >
                                <Trash2 className="size-3.5" />
                                <span>Clear</span>
                            </button>
                        </div>
                    </div>
                )}

                {activePage === "chatbot" && model && activeChat.type === "master" && miniSummaries.length > 0 && (
                    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border/60 bg-background px-4 py-2">
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">Mini summaries</span>
                        {miniSummaries.map((mini) => (
                            <button
                                key={mini.id}
                                type="button"
                                onClick={() => addMiniSummaryToMaster(mini)}
                                disabled={mini.summaryAdded}
                                className="flex h-8 max-w-64 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-60"
                                title={mini.summaryAdded ? "Already added to master" : `Add ${mini.title} to master context`}
                            >
                                {mini.summaryAdded ? (
                                    <CheckCircle2 className="size-3.5" />
                                ) : (
                                    <Plus className="size-3.5" />
                                )}
                                <span className="truncate">{mini.summaryAdded ? "Added" : `Add ${mini.title}`}</span>
                            </button>
                        ))}
                    </div>
                )}

                {activePage === "chatbot" && activeChat.type === "mini" && activeMini?.summary && (
                    <div className="shrink-0 border-b border-border/60 bg-background px-4 py-2">
                        <div className="flex items-start gap-3">
                            <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-muted-foreground">Summary</div>
                                <p className="line-clamp-2 text-sm leading-6 text-foreground">{activeMini.summary}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => addMiniSummaryToMaster(activeMini)}
                                disabled={activeMini.summaryAdded}
                                className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs transition-colors hover:bg-muted disabled:opacity-60"
                            >
                                {activeMini.summaryAdded ? <CheckCircle2 className="size-3.5" /> : <Plus className="size-3.5" />}
                                <span>{activeMini.summaryAdded ? "Added" : "Add to master"}</span>
                            </button>
                        </div>
                    </div>
                )}

                {activePage === "chatbot" && (
                    model ? (
                        <ChatArea
                            key={`${chatKey}-${activeChat.type}-${activeChat.type === "mini" ? activeChat.id : "master"}`}
                            provider={provider}
                            model={model}
                            messages={activeMessages}
                            setMessages={setActiveMessages}
                            pendingContext={activeChat.type === "master" ? pendingMasterContext : undefined}
                            onPendingContextSent={activeChat.type === "master" ? clearPendingMasterContext : undefined}
                        />
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                Select Your Headmaster Model
                            </h1>
                            {modelCombobox("w-[min(22rem,calc(100vw-2rem))]")}
                        </div>
                    )
                )}

                {activePage === "apikey" && (
                    <ApiKey />
                )}
            </div>

            {modelChangeAlertToast()}
        </div>
    );
}

export default Chatbot;
