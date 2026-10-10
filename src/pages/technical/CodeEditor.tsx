import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

// A CodeMirror 6 editor (syntax highlighting, auto-indent, bracket matching, Tab to indent).

type Props = {
  value: string;
  lang: "python3" | "javascript";
  onChange: (code: string) => void;
  onRun?: () => void;
};

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "#0d1020" },
  ".cm-scroller": { fontFamily: '"SF Mono", Menlo, Consolas, monospace', lineHeight: "1.55" },
  ".cm-gutters": { backgroundColor: "#0d1020", borderRight: "1px solid rgba(255,255,255,0.06)" },
});

export default function CodeEditor({ value, lang, onChange, onRun }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef({ onChange, onRun });
  handlers.current = { onChange, onRun };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([
            indentWithTab,
            { key: "Mod-Enter", run: () => (handlers.current.onRun?.(), true) },
          ]),
          indentUnit.of(lang === "python3" ? "    " : "  "),
          lang === "python3" ? python() : javascript(),
          oneDark,
          theme,
          EditorView.updateListener.of((u) => u.docChanged && handlers.current.onChange(u.state.doc.toString())),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // Recreate the editor when the language changes; value changes from outside are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div className="nc-editor" ref={host} />;
}
