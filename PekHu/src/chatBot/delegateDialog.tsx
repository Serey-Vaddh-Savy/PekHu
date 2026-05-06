import { useEffect, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";

import { API_PROVIDERS, PROVIDER_COLORS, PROVIDER_MODELS, type Provider } from "../data/api";
import { Button } from "../components/ui/button";
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxList,
} from "../components/ui/combobox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";

export type DelegateDialogData = {
    provider: Provider;
    model: string;
    task: string;
    attachedFile: string;
};

export type DelegateDialogProps = {
    open: boolean;
    provider: string;
    model?: string;
    task: string;
    attachedFile: string;
    onOpenChange: (open: boolean) => void;
    onCreate?: (delegate: DelegateDialogData) => void;
};

const formatOutputPrice = (outputPer1M: number | null) =>
    outputPer1M == null ? "Pricing unavailable" : `$${outputPer1M.toFixed(2)} / 1M output tokens`;

const formatSelectedOutputPrice = (outputPer1M: number | null) =>
    outputPer1M == null ? "Pricing unavailable" : `$${outputPer1M.toFixed(2)}`;

function resolveProvider(providerName: string): Provider {
    const normalized = providerName.trim().toLowerCase();
    const exactProvider = API_PROVIDERS.find((item) => item.toLowerCase() === normalized);

    if (exactProvider) return exactProvider;
    if (normalized.includes("openai") || normalized.includes("gpt")) return "OpenAI";
    if (normalized.includes("anthropic") || normalized.includes("claude")) return "Anthropic";
    if (normalized.includes("google") || normalized.includes("gemini")) return "Google";
    if (normalized.includes("deepseek")) return "DeepSeek";
    if (normalized.includes("minimax") || normalized.includes("mini max")) return "Minimax";

    return "DeepSeek";
}

function getInitialModel(provider: Provider, model?: string) {
    const models = PROVIDER_MODELS[provider];

    if (model && models.some((item) => item.id === model)) {
        return model;
    }

    return models[0]?.id ?? "";
}

function DelegateDialog({
    open,
    provider,
    model,
    task,
    attachedFile,
    onOpenChange,
    onCreate,
}: DelegateDialogProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState<DelegateDialogData>({
        provider: resolveProvider(provider),
        model: getInitialModel(resolveProvider(provider), model),
        task,
        attachedFile,
    });
    const [providerComboboxOpen, setProviderComboboxOpen] = useState(false);
    const [modelComboboxOpen, setModelComboboxOpen] = useState(false);
    const [modelShowModelsFor, setModelShowModelsFor] = useState<Provider | null>(null);

    const selectedModelPrice =
        draft.model
            ? PROVIDER_MODELS[draft.provider].find((providerModel) => providerModel.id === draft.model)?.outputPer1M ?? null
            : null;
    const modelLabel = draft.model ? `${draft.model} - ${formatSelectedOutputPrice(selectedModelPrice)}` : "";

    useEffect(() => {
        if (!open) return;

        const nextProvider = resolveProvider(provider);

        setDraft({
            provider: nextProvider,
            model: getInitialModel(nextProvider, model),
            task,
            attachedFile,
        });
        setIsEditing(false);
        setProviderComboboxOpen(false);
        setModelComboboxOpen(false);
        setModelShowModelsFor(null);
    }, [attachedFile, model, open, provider, task]);

    const updateDraft = (key: "task" | "attachedFile", value: string) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const selectProvider = (nextProvider: Provider) => {
        setDraft((current) => ({
            ...current,
            provider: nextProvider,
            model: getInitialModel(nextProvider),
        }));
        setProviderComboboxOpen(false);
    };

    const selectModel = (nextProvider: Provider, nextModel: string) => {
        setDraft((current) => ({ ...current, provider: nextProvider, model: nextModel }));
        setModelComboboxOpen(false);
        setModelShowModelsFor(null);
    };

    const clearModel = () => {
        setDraft((current) => ({ ...current, model: "" }));
    };

    const handleModelComboboxOpenChange = (open: boolean) => {
        setModelComboboxOpen(open);
        setModelShowModelsFor(open ? draft.provider : null);
    };

    const toggleEditing = () => {
        setIsEditing((editing) => {
            const nextEditing = !editing;

            if (!nextEditing) {
                setProviderComboboxOpen(false);
                setModelComboboxOpen(false);
                setModelShowModelsFor(null);
            }

            return nextEditing;
        });
    };

    const createMiniChat = () => {
        onCreate?.({
            provider: draft.provider,
            model: draft.model,
            task: draft.task.trim(),
            attachedFile: draft.attachedFile.trim(),
        });
    };

    const canCreate = Boolean(onCreate && draft.provider && draft.model && draft.task.trim());

    return (
        <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Delegated response</DialogTitle>
                    <DialogDescription>
                        Review or modify the provider, model, instructions, and context before creating a mini chat.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1 text-sm">
                    <div className="flex flex-row gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium uppercase text-muted-foreground">Provider</div>
                            {isEditing ? (
                                <Combobox open={providerComboboxOpen} onOpenChange={setProviderComboboxOpen}>
                                    <ComboboxInput
                                        value={draft.provider}
                                        readOnly
                                        showTrigger
                                        showClear={false}
                                        className="mt-1 w-full"
                                    />
                                    <ComboboxContent side="bottom" align="start">
                                        <ComboboxList>
                                            {API_PROVIDERS.map((item) => (
                                                <li key={item} className="list-none">
                                                    <button
                                                        type="button"
                                                        className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
                                                        onClick={() => selectProvider(item)}
                                                    >
                                                        <span className={["inline-block h-2 w-2 rounded-full", PROVIDER_COLORS[item]].join(" ")}></span>
                                                        <span className="truncate">{item}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ComboboxList>
                                    </ComboboxContent>
                                </Combobox>
                            ) : (
                                <p className="mt-1 truncate text-foreground">{draft.provider}</p>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium uppercase text-muted-foreground">Model</div>
                            {isEditing ? (
                                <Combobox
                                    open={modelComboboxOpen}
                                    onOpenChange={handleModelComboboxOpenChange}
                                    onValueChange={(value) => {
                                        if (!value) clearModel();
                                    }}
                                >
                                    <ComboboxInput
                                        placeholder={draft.model ? `${draft.provider} - ${draft.model}` : "Select model"}
                                        value={modelLabel}
                                        readOnly
                                        showTrigger
                                        showClear
                                        className="mt-1 w-full"
                                    />
                                    <ComboboxContent side="bottom" align="end">
                                        {modelShowModelsFor && (
                                            <div>
                                                <div className="border-b px-3 py-2 text-sm font-medium">
                                                    {modelShowModelsFor}
                                                </div>
                                                <ul className="max-h-[12.25rem] overflow-y-auto overscroll-contain p-1">
                                                    {PROVIDER_MODELS[modelShowModelsFor].map((item) => (
                                                        <li key={item.id} className="list-none">
                                                            <button
                                                                type="button"
                                                                className="flex h-14 w-full flex-col items-start justify-center gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                                                                onClick={() => selectModel(modelShowModelsFor, item.id)}
                                                            >
                                                                <span className="w-full truncate font-medium">{item.id}</span>
                                                                <span className="w-full truncate text-xs text-muted-foreground">
                                                                    {formatOutputPrice(item.outputPer1M)}
                                                                </span>
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </ComboboxContent>
                                </Combobox>
                            ) : (
                                <p className="mt-1 truncate text-foreground">{draft.model}</p>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs font-medium uppercase text-muted-foreground">Instructions</div>
                        {isEditing ? (
                            <textarea
                                value={draft.task}
                                onChange={(event) => updateDraft("task", event.target.value)}
                                rows={5}
                                placeholder="Describe what the delegated model should do..."
                                className="mt-1 min-h-28 w-full resize-y rounded-md border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors focus:border-border"
                            />
                        ) : (
                            <p className="mt-1 whitespace-pre-wrap text-foreground">{draft.task}</p>
                        )}
                    </div>
                    <div>
                        <div className="text-xs font-medium uppercase text-muted-foreground">Attached context</div>
                        {isEditing ? (
                            <textarea
                                value={draft.attachedFile}
                                onChange={(event) => updateDraft("attachedFile", event.target.value)}
                                rows={4}
                                placeholder="Add files, notes, or context for the delegated model..."
                                className="mt-1 min-h-24 w-full resize-y rounded-md border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors focus:border-border"
                            />
                        ) : (
                            <p className="mt-1 whitespace-pre-wrap text-foreground">{draft.attachedFile}</p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button type="button" variant="outline" onClick={toggleEditing}>
                        {isEditing ? (
                            <>
                                <Check className="size-3.5" />
                                Done
                            </>
                        ) : (
                            <>
                                <Pencil className="size-3.5" />
                                Modify
                            </>
                        )}
                    </Button>
                    <Button type="button" onClick={createMiniChat} disabled={!canCreate}>
                        <Plus className="size-3.5" />
                        Create mini chat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default DelegateDialog;
