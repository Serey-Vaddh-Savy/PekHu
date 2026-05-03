import { useState } from "react";
import { Bot, LifeBuoy, Lightbulb, MessageSquare, Plus, KeyRound, PanelLeft } from "lucide-react";
import ChatArea from "./ChatArea";
import ApiKey from "./ApiKey";
import { API_PROVIDERS, PROVIDER_COLORS, PROVIDER_MODELS, type Provider } from "../data/api";
import {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxList,
    ComboboxItem,
} from "../components/ui/combobox";

const recentChats = [
    { label: "Product onboarding", icon: MessageSquare, isActive: true },
    { label: "Support follow-up", icon: LifeBuoy, isActive: false },
    { label: "Fresh ideas", icon: Lightbulb, isActive: false },
    { label: "API Key", icon: KeyRound, isActive: true },
];

const footerPageOptions = [
    { label: "API Key", icon: KeyRound, value: "apikey" },
    { label: "ChatBot", icon: MessageSquare, value: "chatbot" },
];



function Chatbot() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activePage, setActivePage] = useState("chatbot");
    const [provider, setProvider] = useState<Provider | null>(null);
    const [model, setModel] = useState<string | null>(null);
    const [showModelsFor, setShowModelsFor] = useState<Provider | null>(null);
    const [comboboxOpen, setComboboxOpen] = useState(false);

    return (
        <div className="flex h-svh bg-muted/30">
            {/* Sidebar */}
            <aside
                className={[
                    "flex flex-col bg-sidebar border-r border-sidebar-border/70 transition-all duration-200 overflow-hidden",
                    sidebarOpen ? "w-60 min-w-60 opacity-100" : "w-0 min-w-0 opacity-0",
                ].join(" ")}
            >
                {/* Header */}
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

                    <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm hover:bg-background transition-colors">
                        <Plus className="size-4 shrink-0" />
                        <span className="truncate">Start new chat</span>
                    </button>
                </div>

                {/* Nav */}
                <div className="flex-1 overflow-y-auto px-2 py-3">
                    <p className="px-2 pb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                        Recent
                    </p>
                    <ul className="flex flex-col gap-0.5">
                        {recentChats.map(({ label, icon: Icon, isActive }) => (
                            <li key={label}>
                                <button
                                    className={[
                                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                                        isActive
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                            : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                                    ].join(" ")}
                                >
                                    <Icon className="size-4 shrink-0 opacity-70" />
                                    <span className="truncate">{label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer */}
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

            {/* Main */}
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
                    {activePage == "apikey" && (
                        <h1 className="ml-auto text-sm font-medium">Hi</h1>
                    )}
                    {activePage == "chatbot" && (
                        <div className="ml-auto">
                            <Combobox
                                open={comboboxOpen}
                                onOpenChange={setComboboxOpen}
                                onValueChange={(v) => {
                                    const val = v as string;
                                    if (!val) {
                                        // cleared
                                        setModel(null);
                                        setProvider(null);
                                        setShowModelsFor(null);
                                        return;
                                    }
                                    // model selected
                                    setModel(val);
                                    if (showModelsFor) setProvider(showModelsFor);
                                    setShowModelsFor(null);
                                    setComboboxOpen(false);
                                }}
                            >
                                <ComboboxInput
                                    placeholder={model ? `${provider} — ${model}` : provider ? `Provider: ${provider}` : "Select provider"}
                                    showTrigger
                                    showClear
                                    className="w-56"
                                />

                                <ComboboxContent side="bottom" align="end">
                                    {showModelsFor == null ? (
                                        <ComboboxList>
                                            {API_PROVIDERS.map((p) => (
                                                <li key={p} className="list-none">
                                                    <button
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
                                                    className="text-sm text-muted-foreground"
                                                    onClick={() => setShowModelsFor(null)}
                                                >
                                                    Back
                                                </button>
                                                <div className="text-sm font-medium">{showModelsFor}</div>
                                            </div>
                                            <ComboboxList>
                                                {PROVIDER_MODELS[showModelsFor].map((m) => (
                                                    <ComboboxItem key={m} value={m} className="flex items-center gap-2 px-3 py-2 text-sm">
                                                        <span className="truncate">{m}</span>
                                                    </ComboboxItem>
                                                ))}
                                            </ComboboxList>
                                        </div>
                                    )}
                                </ComboboxContent>
                            </Combobox>
                        </div>
                    )}
                </header>

                {activePage === "chatbot" && (
                    <ChatArea provider={provider} model={model} />
                )}

                {activePage === "apikey" && (
                    <ApiKey />
                )}
            </div>
        </div>
    );
}

export default Chatbot;
