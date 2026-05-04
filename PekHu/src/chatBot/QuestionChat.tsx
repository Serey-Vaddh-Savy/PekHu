import { useEffect, useState } from "react";
import { Check, SkipForward } from "lucide-react";

export interface QuestionAnswer {
    question: string;
    answer: string;
    skipped: boolean;
}

interface QuestionChatProps {
    questions: string[];
    disabled?: boolean;
    onComplete: (answers: QuestionAnswer[]) => void;
}

type QuestionStatus = "pending" | "answered" | "skipped";

export default function QuestionChat({ questions, disabled = false, onComplete }: QuestionChatProps) {
    const [answers, setAnswers] = useState(() => questions.map(() => ""));
    const [statuses, setStatuses] = useState<QuestionStatus[]>(() => questions.map(() => "pending"));
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        setAnswers(questions.map(() => ""));
        setStatuses(questions.map(() => "pending"));
        setSubmitted(false);
    }, [questions]);

    useEffect(() => {
        const isComplete = questions.length > 0 && statuses.every((status) => status !== "pending");

        if (!isComplete || submitted) return;

        setSubmitted(true);
        onComplete(
            questions.map((question, index) => ({
                question,
                answer: answers[index].trim(),
                skipped: statuses[index] === "skipped",
            })),
        );
    }, [answers, onComplete, questions, statuses, submitted]);

    const updateAnswer = (index: number, value: string) => {
        setAnswers((current) => current.map((answer, itemIndex) => (itemIndex === index ? value : answer)));
    };

    const markAnswered = (index: number) => {
        if (!answers[index].trim()) return;
        setStatuses((current) =>
            current.map((status, itemIndex) => (itemIndex === index ? "answered" : status)),
        );
    };

    const skipQuestion = (index: number) => {
        setStatuses((current) =>
            current.map((status, itemIndex) => (itemIndex === index ? "skipped" : status)),
        );
    };

    return (
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/35 p-3 text-sm text-foreground">
            <div className="font-medium">Clarifying questions</div>

            <div className="space-y-3">
                {questions.map((question, index) => {
                    const status = statuses[index];
                    const isDone = status !== "pending";

                    return (
                        <div key={`${question}-${index}`} className="space-y-2">
                            <p className="leading-relaxed">
                                <span className="text-muted-foreground">{index + 1}. </span>
                                {question}
                            </p>

                            <div className="flex items-start gap-2">
                                <textarea
                                    value={answers[index]}
                                    onChange={(event) => updateAnswer(index, event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !event.shiftKey) {
                                            event.preventDefault();
                                            markAnswered(index);
                                        }
                                    }}
                                    disabled={disabled || isDone}
                                    rows={1}
                                    placeholder={status === "skipped" ? "Skipped" : "Answer this question..."}
                                    className="min-h-9 flex-1 resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-border disabled:opacity-70"
                                />

                                <button
                                    type="button"
                                    onClick={() => markAnswered(index)}
                                    disabled={disabled || isDone || !answers[index].trim()}
                                    title="Done"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-foreground text-background transition-opacity hover:opacity-80 disabled:opacity-30"
                                >
                                    <Check className="size-4" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => skipQuestion(index)}
                                    disabled={disabled || isDone}
                                    title="Skip"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                                >
                                    <SkipForward className="size-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
