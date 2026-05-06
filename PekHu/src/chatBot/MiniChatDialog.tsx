import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

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

type MiniChatDialogProps = {
    open: boolean;
    defaultProvider: Provider;
    onOpenChange: (open: boolean) => void;
    onCreate: (provider: Provider, model: string) => void;
};

const formatOutputPrice = (outputPer1M: number | null) =>
    outputPer1M == null ? "Pricing unavailable" : `$${outputPer1M.toFixed(2)} / 1M output tokens`;

const formatSelectedOutputPrice = (outputPer1M: number | null) =>
    outputPer1M == null ? "Pricing unavailable" : `$${outputPer1M.toFixed(2)}`;

function MiniChatDialog({
    open,
    onOpenChange,
    onCreate,
}: MiniChatDialogProps) {
    const [provider, setProvider] = useState<Provider | null>(null);
    const [model, setModel] = useState("");
    const [modelComboboxOpen, setModelComboboxOpen] = useState(false);
    const [showModelsFor, setShowModelsFor] = useState<Provider | null>(null);

    const selectedModelPrice =
        provider && model
            ? PROVIDER_MODELS[provider].find((providerModel) => providerModel.id === model)?.outputPer1M ?? null
            : null;
    const modelLabel =
        provider && model ? `${model} - ${formatSelectedOutputPrice(selectedModelPrice)}` : "";

    useEffect(() => {
        if (!open) return;

        setProvider(null);
        setModel("");
        setModelComboboxOpen(false);
        setShowModelsFor(null);
    }, [open]);

    const selectModel = (nextProvider: Provider, nextModel: string) => {
        setProvider(nextProvider);
        setModel(nextModel);
        setModelComboboxOpen(false);
        setShowModelsFor(null);
    };

    const closeDialog = () => {
        setModelComboboxOpen(false);
        setShowModelsFor(null);
        onOpenChange(false);
    };

    const createMiniChat = () => {
        if (!provider || !model) return;

        onCreate(provider, model);
        closeDialog();
    };

    return (
        <Dialog
            modal={false}
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    closeDialog();
                    return;
                }

                onOpenChange(true);
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create mini chat</DialogTitle>
                    <DialogDescription>
                        Choose the AI provider and AI model for this mini chat.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">AI model</label>
                        <Combobox
                            open={modelComboboxOpen}
                            onOpenChange={setModelComboboxOpen}
                            onValueChange={(value) => {
                                if (!value) {
                                    setProvider(null);
                                    setModel("");
                                    setShowModelsFor(null);
                                }
                            }}
                        >
                            <ComboboxInput
                                placeholder="Select AI provider, then model"
                                value={modelLabel}
                                readOnly
                                showTrigger
                                showClear
                                className="w-full"
                            />

                            <ComboboxContent side="bottom" align="start">
                                {showModelsFor == null ? (
                                    <ComboboxList>
                                        {API_PROVIDERS.map((item) => (
                                            <li key={item} className="list-none">
                                                <button
                                                    type="button"
                                                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent"
                                                    onClick={() => {
                                                        setShowModelsFor(item);
                                                        setProvider(item);
                                                        setModel("");
                                                        setModelComboboxOpen(true);
                                                    }}
                                                >
                                                    <span className={["inline-block h-2 w-2 rounded-full", PROVIDER_COLORS[item]].join(" ")}></span>
                                                    <span className="truncate">{item}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ComboboxList>
                                ) : (
                                    <div>
                                        <div className="flex items-center justify-between border-b px-3 py-2">
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
                                            {PROVIDER_MODELS[showModelsFor].map((item) => (
                                                <li key={item.id} className="list-none">
                                                    <button
                                                        type="button"
                                                        className="flex h-14 w-full flex-col items-start justify-center gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                                                        onClick={() => selectModel(showModelsFor, item.id)}
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
                        {provider && model && (
                            <p className="text-xs text-muted-foreground">
                                {provider} output pricing: {formatOutputPrice(selectedModelPrice)}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeDialog}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={createMiniChat} disabled={!provider || !model}>
                        <Plus className="size-3.5" />
                        Create mini chat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default MiniChatDialog;
