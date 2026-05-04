import { useState } from "react";
import { Bot, LifeBuoy, Lightbulb, MessageSquare, Plus, KeyRound, PanelLeft } from "lucide-react";
import ChatArea from "./ChatArea";
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


type PendingModel = ProviderModel & {
    provider: Provider;
};

function Chatbot() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activePage, setActivePage] = useState("chatbot");
    const [provider, setProvider] = useState<Provider | null>(null);
    const [model, setModel] = useState<string | null>(null);
    const [showModelsFor, setShowModelsFor] = useState<Provider | null>(null);
    const [comboboxOpen, setComboboxOpen] = useState(false);
    const [chatKey, setChatKey] = useState(0);
    const [pendingModel, setPendingModel] = useState<PendingModel | null>(null);
    const [recentChat, setRecentChat] = useState([]); //['chatTitle', 'chatInfo'] chatInfo is saved somewhere in the frontend

    const handleNewChat = () => {
        setChatKey((k) => k + 1);
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
            confirmLabel="Use model"
            cancelLabel="Change"
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

                    <button onClick={handleNewChat} className="flex w-full items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm hover:bg-background transition-colors">
                        <Plus className="size-4 shrink-0" />
                        <span className="truncate">Start new chat</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-3">
                    <p className="px-2 pb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                        Recent
                    </p>
                    
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
                    <span className="text-sm text-muted-foreground">Toggle sidebar</span>
                    {activePage === "apikey" && (
                        <h1 className="ml-auto text-sm font-medium"></h1>
                    )}
                    {activePage === "chatbot" && model && (
                        <div className="ml-auto">
                            {modelCombobox()}
                        </div>
                    )}
                </header>

                {activePage === "chatbot" && (
                    model ? (
                        <ChatArea key={chatKey} provider={provider} model={model} />
                    ) : (
                        <div className="flex flex-1 items-center justify-center px-4">
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
