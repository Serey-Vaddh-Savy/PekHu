import type { ReactNode } from "react";
import { Copy } from "lucide-react";

interface ResponseChatProps {
    content: string;
}

const unorderedListPattern = /^\s*[-*+]\s+(.+)$/;
const orderedListPattern = /^\s*\d+[.)]\s+(.+)$/;
const headingPattern = /^(#{1,3})\s+(.+)$/;
const codeFenceStartPattern = /^```([a-zA-Z0-9_-]+)?\s*$/;
const tableSeparatorCellPattern = /^:?-{3,}:?$/;

type TableAlignment = "left" | "center" | "right";

function normalizeContent(content: string) {
    return content
        .replace(/\r\n?/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/:\s+-\s+(?=\*\*)/g, ":\n\n- ")
        .replace(/([.!?])\s+-\s+(?=\*\*)/g, "$1\n- ")
        .trim();
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
    const tokens = text.split(/(\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+?`|\*[^*]+?\*|_[^_]+?_)/g);

    return tokens
        .filter(Boolean)
        .map((token, index) => {
            const key = `${keyPrefix}-${index}`;

            if (
                (token.startsWith("**") && token.endsWith("**")) ||
                (token.startsWith("__") && token.endsWith("__"))
            ) {
                return (
                    <strong key={key} className="font-semibold text-foreground">
                        {token.slice(2, -2)}
                    </strong>
                );
            }

            if (token.startsWith("`") && token.endsWith("`")) {
                return (
                    <code
                        key={key}
                        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
                    >
                        {token.slice(1, -1)}
                    </code>
                );
            }

            if (
                (token.startsWith("*") && token.endsWith("*")) ||
                (token.startsWith("_") && token.endsWith("_"))
            ) {
                return (
                    <em key={key} className="italic">
                        {token.slice(1, -1)}
                    </em>
                );
            }

            return token;
        });
}

function getListItem(line: string) {
    return line.match(unorderedListPattern)?.[1] ?? line.match(orderedListPattern)?.[1] ?? null;
}

function splitTableRow(line: string) {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    const cells: string[] = [];
    let cell = "";
    let escaped = false;

    for (const char of trimmed) {
        if (escaped) {
            cell += char;
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (char === "|") {
            cells.push(cell.trim());
            cell = "";
            continue;
        }

        cell += char;
    }

    cells.push(cell.trim());

    return cells;
}

function isPotentialTableRow(line: string) {
    return line.includes("|") && splitTableRow(line).length >= 2;
}

function isTableSeparatorRow(line: string) {
    const cells = splitTableRow(line);

    return cells.length >= 2 && cells.every((cell) => tableSeparatorCellPattern.test(cell.replace(/\s+/g, "")));
}

function getTableAlignments(separatorLine: string): TableAlignment[] {
    return splitTableRow(separatorLine).map((cell) => {
        const compact = cell.replace(/\s+/g, "");
        const startsWithColon = compact.startsWith(":");
        const endsWithColon = compact.endsWith(":");

        if (startsWithColon && endsWithColon) return "center";
        if (endsWithColon) return "right";

        return "left";
    });
}

function isCodeFenceStart(line: string) {
    return Boolean(line.trim().match(codeFenceStartPattern));
}

function isCodeFenceEnd(line: string) {
    const trimmed = line.trim();

    return trimmed === "```" || trimmed === "`";
}

function renderCodeBlock(code: string, language: string | undefined, key: string) {
    const label = language || "code";

    return (
        <div key={key} className="overflow-hidden rounded-lg border border-border bg-zinc-100 text-zinc-950 shadow-sm">
            <div className="flex h-9 items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {label}
                </span>
                <button
                    type="button"
                    title="Copy code"
                    onClick={() => navigator.clipboard?.writeText(code)}
                    className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
                >
                    <Copy className="size-3.5" />
                </button>
            </div>
            <pre className="max-w-full overflow-x-auto p-3 text-[13px] leading-relaxed">
                <code className="font-mono whitespace-pre text-sky-950">{code}</code>
            </pre>
        </div>
    );
}

function renderParagraph(lines: string[], key: string) {
    return (
        <p key={key}>
            {lines.map((line, lineIndex) => (
                <span key={`${key}-line-${lineIndex}`}>
                    {lineIndex > 0 && <br />}
                    {renderInline(line.trim(), `${key}-inline-${lineIndex}`)}
                </span>
            ))}
        </p>
    );
}

function renderTable(header: string[], alignments: TableAlignment[], rows: string[][], key: string) {
    const columnCount = header.length;
    const getAlignmentClass = (columnIndex: number) => {
        const alignment = alignments[columnIndex] ?? "left";

        if (alignment === "center") return "text-center";
        if (alignment === "right") return "text-right";

        return "text-left";
    };
    const normalizeCells = (cells: string[]) =>
        Array.from({ length: columnCount }, (_, columnIndex) => cells[columnIndex] ?? "");

    return (
        <div key={key} className="overflow-x-auto rounded-lg border border-border/70">
            <table className="min-w-full border-collapse text-sm leading-6">
                <thead className="bg-muted/70">
                    <tr>
                        {normalizeCells(header).map((cell, columnIndex) => (
                            <th
                                key={`${key}-head-${columnIndex}`}
                                scope="col"
                                className={[
                                    "border-b border-border/70 px-3 py-2 font-semibold text-foreground",
                                    getAlignmentClass(columnIndex),
                                ].join(" ")}
                            >
                                {renderInline(cell, `${key}-head-${columnIndex}`)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-background">
                    {rows.map((row, rowIndex) => (
                        <tr key={`${key}-row-${rowIndex}`} className="align-top">
                            {normalizeCells(row).map((cell, columnIndex) => (
                                <td
                                    key={`${key}-row-${rowIndex}-cell-${columnIndex}`}
                                    className={[
                                        "px-3 py-2 text-foreground",
                                        getAlignmentClass(columnIndex),
                                    ].join(" ")}
                                >
                                    {renderInline(cell, `${key}-row-${rowIndex}-cell-${columnIndex}`)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function ResponseChat({ content }: ResponseChatProps) {
    const normalized = normalizeContent(content);
    const lines = normalized.split("\n");
    const blocks: ReactNode[] = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        const trimmed = line.trim();

        if (!trimmed) {
            index += 1;
            continue;
        }

        const codeFenceMatch = trimmed.match(codeFenceStartPattern);
        if (codeFenceMatch) {
            const language = codeFenceMatch[1];
            const codeLines: string[] = [];
            index += 1;

            while (index < lines.length && !isCodeFenceEnd(lines[index])) {
                codeLines.push(lines[index]);
                index += 1;
            }

            if (index < lines.length && isCodeFenceEnd(lines[index])) {
                index += 1;
            }

            blocks.push(renderCodeBlock(codeLines.join("\n").replace(/\n+$/g, ""), language, `code-${index}`));
            continue;
        }

        const headingMatch = trimmed.match(headingPattern);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const headingText = headingMatch[2];
            const className = level === 1 ? "text-base font-semibold" : "text-sm font-semibold";

            blocks.push(
                <div key={`heading-${index}`} className={className}>
                    {renderInline(headingText, `heading-${index}`)}
                </div>,
            );
            index += 1;
            continue;
        }

        if (
            index + 1 < lines.length &&
            isPotentialTableRow(trimmed) &&
            isTableSeparatorRow(lines[index + 1])
        ) {
            const header = splitTableRow(trimmed);
            const alignments = getTableAlignments(lines[index + 1]);
            const rows: string[][] = [];

            index += 2;
            while (index < lines.length && isPotentialTableRow(lines[index]) && lines[index].trim()) {
                rows.push(splitTableRow(lines[index]));
                index += 1;
            }

            blocks.push(renderTable(header, alignments, rows, `table-${index}`));
            continue;
        }

        const unorderedItem = trimmed.match(unorderedListPattern);
        const orderedItem = trimmed.match(orderedListPattern);
        if (unorderedItem || orderedItem) {
            const isOrdered = Boolean(orderedItem);
            const items: string[] = [];

            while (index < lines.length) {
                const item = isOrdered
                    ? lines[index].trim().match(orderedListPattern)?.[1]
                    : lines[index].trim().match(unorderedListPattern)?.[1];

                if (!item) break;
                items.push(item);
                index += 1;
            }

            const ListTag = isOrdered ? "ol" : "ul";
            const listClass = isOrdered
                ? "list-decimal space-y-1 pl-5 marker:text-muted-foreground"
                : "list-disc space-y-1 pl-5 marker:text-muted-foreground";

            blocks.push(
                <ListTag key={`list-${index}`} className={listClass}>
                    {items.map((item, itemIndex) => (
                        <li key={`list-${index}-item-${itemIndex}`} className="pl-1">
                            {renderInline(item.trim(), `list-${index}-item-${itemIndex}`)}
                        </li>
                    ))}
                </ListTag>,
            );
            continue;
        }

        const paragraphLines: string[] = [];
        while (index < lines.length) {
            const paragraphLine = lines[index].trim();

            if (
                !paragraphLine ||
                paragraphLine.match(headingPattern) ||
                getListItem(paragraphLine) ||
                (
                    index + 1 < lines.length &&
                    isPotentialTableRow(paragraphLine) &&
                    isTableSeparatorRow(lines[index + 1])
                ) ||
                isCodeFenceStart(paragraphLine)
            ) {
                break;
            }

            paragraphLines.push(paragraphLine);
            index += 1;
        }

        blocks.push(renderParagraph(paragraphLines, `paragraph-${index}`));
    }

    return (
        <div className="max-w-none space-y-4 text-left text-[15px] leading-7 text-foreground">
            {blocks}
        </div>
    );
}
