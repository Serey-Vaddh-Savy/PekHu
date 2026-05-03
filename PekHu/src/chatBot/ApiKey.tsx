import { useEffect, useState } from "react"
import { Eye, EyeOff, KeyRound, Lock, Trash2 } from "lucide-react"
import { API_PROVIDERS, PROVIDER_COLORS, Provider } from "../data/api";

function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

type SavedKey = { id: string; provider: Provider; key: string }

function maskKey(key: string) {
    if (!key) return ""
    if (key.length <= 8) return "•".repeat(key.length)
    return `${key.slice(0, 4)}${"•".repeat(Math.max(0, key.length - 8))}${key.slice(-4)}`
}

export default function ApiKey() {
    const [provider, setProvider] = useState<Provider>("OpenAI")
    const [keyInput, setKeyInput] = useState("")
    const [savedKeys, setSavedKeys] = useState<SavedKey[]>([])
    const [visibleIds, setVisibleIds] = useState<Record<string, boolean>>({})

    useEffect(() => {
        try {
            const raw = localStorage.getItem("peakhu_api_keys")
            if (raw) setSavedKeys(JSON.parse(raw))
        } catch {}
    }, [])

    useEffect(() => {
        try {
            localStorage.setItem("peakhu_api_keys", JSON.stringify(savedKeys))
        } catch {}
    }, [savedKeys])

    function addKey() {
        if (!keyInput.trim()) return
        setSavedKeys((prev) => [{ id: generateId(), provider, key: keyInput.trim() }, ...prev])
        setKeyInput("")
    }

    function removeKey(id: string) {
        setSavedKeys((prev) => prev.filter((k) => k.id !== id))
        setVisibleIds((prev) => { const c = { ...prev }; delete c[id]; return c })
    }

    function toggleVisible(id: string) {
        setVisibleIds((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    return (
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-8">
            <div className="mx-auto max-w-[600px] space-y-6">

                {/* Page heading */}
                <div>
                    <h1 className="text-lg font-medium tracking-tight text-foreground">API keys</h1>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        Connect your provider keys to power Peakhu AI with your own limits and billing.
                    </p>
                </div>

                {/* Add key card */}
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-border/50 px-5 py-3.5">
                        <KeyRound className="size-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                            Add new key
                        </span>
                    </div>
                    <div className="px-5 py-5 space-y-4">
                        {/* Provider segmented control */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Provider</label>
                            <div className="flex rounded-lg border border-border/60 overflow-hidden">
                                {API_PROVIDERS.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setProvider(p)}
                                        className={[
                                            "flex-1 py-1.5 text-xs transition-colors",
                                            provider === p
                                                ? "bg-muted font-medium text-foreground"
                                                : "text-muted-foreground hover:bg-muted/50",
                                        ].join(" ")}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Key input + add button */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">API key</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={keyInput}
                                    onChange={(e) => setKeyInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addKey()}
                                    placeholder="sk-… or provider token"
                                    className="flex-1 h-9 rounded-lg border border-border/60 bg-muted/40 px-3 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
                                />
                                <button
                                    onClick={addKey}
                                    disabled={!keyInput.trim()}
                                    className="h-9 px-4 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-30 hover:opacity-80 transition-opacity"
                                >
                                    Add key
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Saved keys card */}
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-border/50 px-5 py-3.5">
                        <Lock className="size-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                            Saved keys
                        </span>
                        {savedKeys.length > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground">{savedKeys.length}</span>
                        )}
                    </div>

                    {savedKeys.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                            No keys added yet. Add your first key above.
                        </div>
                    ) : (
                        <ul>
                            {savedKeys.map((k, i) => (
                                <li
                                    key={k.id}
                                    className={[
                                        "flex items-center gap-3 px-5 py-3.5",
                                        i < savedKeys.length - 1 ? "border-b border-border/40" : "",
                                    ].join(" ")}
                                >
                                    {/* Provider dot */}
                                    <div className={`size-2 rounded-full shrink-0 ${PROVIDER_COLORS[k.provider]}`} />

                                    {/* Key info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-foreground">{k.provider}</div>
                                        <div className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
                                            {visibleIds[k.id] ? k.key : maskKey(k.key)}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => toggleVisible(k.id)}
                                            aria-label={visibleIds[k.id] ? "Hide key" : "Show key"}
                                            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                        >
                                            {visibleIds[k.id]
                                                ? <EyeOff className="size-3.5" />
                                                : <Eye className="size-3.5" />
                                            }
                                        </button>
                                        <button
                                            onClick={() => removeKey(k.id)}
                                            aria-label="Delete key"
                                            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

            </div>
        </div>
    )
}