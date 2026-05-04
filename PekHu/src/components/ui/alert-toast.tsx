import { AlertCircle, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AlertToastProps = {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    className?: string;
};

function AlertToast({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Change",
    onConfirm,
    onCancel,
    className,
}: AlertToastProps) {
    if (!open) return null;

    return (
        <div
            role="alertdialog"
            aria-modal="false"
            aria-labelledby="alert-toast-title"
            aria-describedby={description ? "alert-toast-description" : undefined}
            className={cn(
                "fixed bottom-4 right-4 z-[60] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-4 text-foreground shadow-lg",
                className
            )}
        >
            <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <AlertCircle className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div id="alert-toast-title" className="text-sm font-semibold">
                        {title}
                    </div>
                    {description && (
                        <div id="alert-toast-description" className="mt-1 text-sm text-muted-foreground">
                            {description}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                    <X className="size-3.5" />
                    {cancelLabel}
                </Button>
                <Button type="button" size="sm" onClick={onConfirm}>
                    <Check className="size-3.5" />
                    {confirmLabel}
                </Button>
            </div>
        </div>
    );
}

export { AlertToast };
