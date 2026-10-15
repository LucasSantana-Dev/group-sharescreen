"use client";

import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { roomTools, type TextTool } from "@/lib/roomTools";
import { markFeatureUsed } from "@/components/NewBadge";
import { VSCODE_EDITOR_FEATURE } from "@/lib/clipsMode";

// The room's code editor drawn by Monaco — the editor inside VS Code — for
// whoever is in the room-code-vscode experiment and turned it on (see
// TextToolView). Monaco itself is fetched from jsdelivr by @monaco-editor/react
// the first time one opens, so nobody else pays for its few MB.
//
// The text still belongs to lib/roomTools (OT through lib/textSync): what is
// typed here goes out as the whole new text, like the textarea's onChange, and
// a text that changed elsewhere comes in as one minimal edit (common prefix and
// suffix kept), which lets Monaco move every cursor and selection past it
// instead of resetting them.

const MAX_LENGTH = 40_000;

// CODE_LANGUAGES → Monaco's ids; only bash is named differently.
const MONACO_LANGUAGE: Record<string, string> = { bash: "shell" };

function useDarkTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.getAttribute("data-theme") === "dark");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

type MonacoEditor = Parameters<OnMount>[0];

export default function VsCodeEditor({ tool, canUse, placeholder }: { tool: TextTool; canUse: boolean; placeholder: string }) {
  const dark = useDarkTheme();
  const editorRef = useRef<MonacoEditor | null>(null);
  // Set while a remote edit is being applied, so it is not sent back out.
  const applyingRemote = useRef(false);
  const usedRef = useRef(false);

  // A text that changed elsewhere: one edit spanning only what differs.
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;
    const current = model.getValue();
    const next = tool.text;
    if (current === next) return;
    let start = 0;
    const max = Math.min(current.length, next.length);
    while (start < max && current.charCodeAt(start) === next.charCodeAt(start)) start++;
    let endCur = current.length;
    let endNext = next.length;
    while (endCur > start && endNext > start && current.charCodeAt(endCur - 1) === next.charCodeAt(endNext - 1)) {
      endCur--;
      endNext--;
    }
    const from = model.getPositionAt(start);
    const to = model.getPositionAt(endCur);
    applyingRemote.current = true;
    try {
      model.applyEdits([
        {
          range: { startLineNumber: from.lineNumber, startColumn: from.column, endLineNumber: to.lineNumber, endColumn: to.column },
          text: next.slice(start, endNext),
        },
      ]);
    } finally {
      applyingRemote.current = false;
    }
  }, [tool.text]);

  return (
    <div className="relative h-full w-full">
      <Editor
        defaultValue={tool.text}
        language={MONACO_LANGUAGE[tool.language] ?? tool.language}
        theme={dark ? "vs-dark" : "vs"}
        onMount={(editor) => {
          editorRef.current = editor;
          // Keys the room listens for (shortcuts) stay out of the code.
          editor.getDomNode()?.addEventListener("keydown", (event) => event.stopPropagation());
          // The text may have moved on while Monaco was loading.
          if (editor.getValue() !== tool.text) editor.setValue(tool.text);
        }}
        onChange={(value) => {
          if (applyingRemote.current || value === undefined) return;
          if (value.length > MAX_LENGTH) {
            editorRef.current?.trigger("limit", "undo", null);
            return;
          }
          roomTools.editText(tool.id, value);
          if (!usedRef.current) {
            usedRef.current = true;
            markFeatureUsed(VSCODE_EDITOR_FEATURE);
          }
        }}
        options={{
          readOnly: !canUse,
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          tabSize: 2,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          placeholder,
        }}
      />
    </div>
  );
}
