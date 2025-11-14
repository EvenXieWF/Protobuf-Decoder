import React, { useRef, useEffect } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, gutter, placeholder, Decoration } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { protobuf } from '@codemirror/legacy-modes/mode/protobuf';
import { StreamLanguage } from '@codemirror/language';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'protobuf' | 'none';
  placeholder?: string;
  errorRange?: [number, number] | null;
  highlightRange?: [number, number] | null;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'none',
  placeholder: placeholderText = '',
  errorRange = null,
  highlightRange = null,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const errorHighlightCompartment = useRef(new Compartment());
  const syncHighlightCompartment = useRef(new Compartment());

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      lineNumbers(),
      gutter({ class: 'cm-mygutter' }),
      history(),
      foldGutter(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
      placeholder(placeholderText),
      errorHighlightCompartment.current.of([]),
      syncHighlightCompartment.current.of([]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
    ];

    if (language === 'protobuf') {
      extensions.push(StreamLanguage.define(protobuf));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, placeholderText]);

  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    if (!viewRef.current) return;

    const highlightMark = Decoration.mark({
        class: "cm-error-highlight",
        attributes: { title: "Error occurred around here" }
    });

    const decorations = errorRange
        ? [highlightMark.range(errorRange[0], errorRange[1])]
        : [];
    
    viewRef.current.dispatch({
        effects: errorHighlightCompartment.current.reconfigure(
            EditorView.decorations.of(Decoration.set(decorations))
        )
    });
  }, [errorRange]);

  useEffect(() => {
    if (!viewRef.current) return;

    const highlightMark = Decoration.mark({ class: "cm-sync-highlight" });

    const decorations = highlightRange
      ? [highlightMark.range(highlightRange[0], highlightRange[1])]
      : [];

    const effects = [
      syncHighlightCompartment.current.reconfigure(
        EditorView.decorations.of(Decoration.set(decorations))
      ),
    ];

    if (highlightRange) {
      effects.push(EditorView.scrollIntoView(highlightRange[0], { x: 'center', y: 'center' }));
    }

    viewRef.current.dispatch({ effects });
  }, [highlightRange]);


  return <div ref={editorRef} className="h-full w-full" />;
};

export default CodeEditor;