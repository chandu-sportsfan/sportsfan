"use client";

import { useRef, useCallback, useEffect } from "react";
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    List,
    ListOrdered,
    Quote,
    Link,
    RemoveFormatting,
    Heading2,
    AlignLeft,
    AlignCenter,
    AlignRight,
} from "lucide-react";

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minHeight?: number;
}

type ToolbarButton = {
    icon: React.ReactNode;
    command: string;
    arg?: string;
    title: string;
    isBlock?: boolean;
};

const TOOLBAR_GROUPS: ToolbarButton[][] = [
    [
        { icon: <Bold size={14} />, command: "bold", title: "Bold (Ctrl+B)" },
        { icon: <Italic size={14} />, command: "italic", title: "Italic (Ctrl+I)" },
        { icon: <Underline size={14} />, command: "underline", title: "Underline (Ctrl+U)" },
        { icon: <Strikethrough size={14} />, command: "strikeThrough", title: "Strikethrough" },
    ],
    [
        { icon: <Heading2 size={14} />, command: "formatBlock", arg: "h2", title: "Heading", isBlock: true },
        { icon: <Quote size={14} />, command: "formatBlock", arg: "blockquote", title: "Blockquote", isBlock: true },
    ],
    [
        { icon: <List size={14} />, command: "insertUnorderedList", title: "Bullet List" },
        { icon: <ListOrdered size={14} />, command: "insertOrderedList", title: "Numbered List" },
    ],
    [
        { icon: <AlignLeft size={14} />, command: "justifyLeft", title: "Align Left" },
        { icon: <AlignCenter size={14} />, command: "justifyCenter", title: "Align Center" },
        { icon: <AlignRight size={14} />, command: "justifyRight", title: "Align Right" },
    ],
    [
        { icon: <Link size={14} />, command: "createLink", title: "Insert Link" },
        { icon: <RemoveFormatting size={14} />, command: "removeFormat", title: "Clear Formatting" },
    ],
];

export function RichTextEditor({
    value,
    onChange,
    placeholder = "Write here...",
    minHeight = 140,
}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const isInternalUpdate = useRef(false);

    // Sync external value into editor only when it truly differs
    useEffect(() => {
        if (!editorRef.current) return;
        if (isInternalUpdate.current) return;
        if (editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const exec = useCallback(
        (command: string, arg?: string) => {
            if (command === "createLink") {
                const url = prompt("Enter URL:", "https://");
                if (!url) return;
                document.execCommand("createLink", false, url);
            } else if (command === "formatBlock" && arg) {
                // Toggle: if already in that block, revert to <p>
                const current = document.queryCommandValue("formatBlock");
                document.execCommand(
                    "formatBlock",
                    false,
                    current.toLowerCase() === arg.toLowerCase() ? "p" : arg
                );
            } else {
                document.execCommand(command, false, arg);
            }
            editorRef.current?.focus();
            // Emit change
            isInternalUpdate.current = true;
            onChange(editorRef.current?.innerHTML ?? "");
            setTimeout(() => {
                isInternalUpdate.current = false;
            }, 0);
        },
        [onChange]
    );

    const handleInput = useCallback(() => {
        isInternalUpdate.current = true;
        onChange(editorRef.current?.innerHTML ?? "");
        setTimeout(() => {
            isInternalUpdate.current = false;
        }, 0);
    }, [onChange]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Tab") {
                e.preventDefault();
                document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
            }
        },
        []
    );

    const isActive = (command: string, arg?: string) => {
        try {
            if (arg && command === "formatBlock") {
                return document.queryCommandValue("formatBlock").toLowerCase() === arg.toLowerCase();
            }
            return document.queryCommandState(command);
        } catch {
            return false;
        }
    };

    const isEmpty = !value || value === "<br>" || value === "";

    return (
        <div className="rich-editor-wrapper">
            {/* Toolbar */}
            <div className="rich-toolbar">
                {TOOLBAR_GROUPS.map((group, gi) => (
                    <div key={gi} className="toolbar-group">
                        {group.map((btn) => (
                            <button
                                key={btn.command + (btn.arg ?? "")}
                                type="button"
                                title={btn.title}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // prevent losing selection
                                    exec(btn.command, btn.arg);
                                }}
                                className={`toolbar-btn ${isActive(btn.command, btn.arg) ? "active" : ""}`}
                            >
                                {btn.icon}
                            </button>
                        ))}
                        {gi < TOOLBAR_GROUPS.length - 1 && (
                            <div className="toolbar-sep" />
                        )}
                    </div>
                ))}
            </div>

            {/* Editable area */}
            <div className="editor-area-wrapper">
                {isEmpty && (
                    <div className="editor-placeholder" aria-hidden="true">
                        {placeholder}
                    </div>
                )}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    className="editor-area"
                    style={{ minHeight }}
                    spellCheck
                />
            </div>

            <style>{`
                .rich-editor-wrapper {
                    border: 1px solid #374151;
                    border-radius: 8px;
                    background: #0d1117;
                    overflow: hidden;
                    transition: border-color 0.15s;
                }
                .rich-editor-wrapper:focus-within {
                    border-color: #3b82f6;
                }

                /* Toolbar */
                .rich-toolbar {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 2px;
                    padding: 6px 8px;
                    border-bottom: 1px solid #1f2937;
                    background: #161b22;
                }
                .toolbar-group {
                    display: flex;
                    align-items: center;
                    gap: 1px;
                }
                .toolbar-sep {
                    width: 1px;
                    height: 18px;
                    background: #374151;
                    margin: 0 4px;
                }
                .toolbar-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border: none;
                    background: transparent;
                    color: #9ca3af;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background 0.12s, color 0.12s;
                }
                .toolbar-btn:hover {
                    background: #1f2937;
                    color: #f9fafb;
                }
                .toolbar-btn.active {
                    background: #1d4ed8;
                    color: #fff;
                }

                /* Editor area */
                .editor-area-wrapper {
                    position: relative;
                }
                .editor-placeholder {
                    position: absolute;
                    top: 10px;
                    left: 12px;
                    color: #4b5563;
                    font-size: 14px;
                    pointer-events: none;
                    user-select: none;
                }
                .editor-area {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 10px 12px;
                    color: #f9fafb;
                    font-size: 14px;
                    line-height: 1.65;
                    outline: none;
                    background: transparent;
                    word-break: break-word;
                }

                /* Rich content styles inside editor */
                .editor-area b, .editor-area strong { font-weight: 700; }
                .editor-area i, .editor-area em { font-style: italic; }
                .editor-area u { text-decoration: underline; }
                .editor-area s { text-decoration: line-through; }
                .editor-area h2 {
                    font-size: 17px;
                    font-weight: 700;
                    margin: 8px 0 4px;
                    color: #f9fafb;
                }
                .editor-area blockquote {
                    border-left: 3px solid #3b82f6;
                    margin: 6px 0;
                    padding: 4px 12px;
                    color: #9ca3af;
                    font-style: italic;
                    background: #161b22;
                    border-radius: 0 4px 4px 0;
                }
                .editor-area ul {
                    list-style: disc;
                    padding-left: 20px;
                    margin: 4px 0;
                }
                .editor-area ol {
                    list-style: decimal;
                    padding-left: 20px;
                    margin: 4px 0;
                }
                .editor-area li { margin: 2px 0; }
                .editor-area a {
                    color: #60a5fa;
                    text-decoration: underline;
                }
                .editor-area p { margin: 0 0 4px; }
            `}</style>
        </div>
    );
}