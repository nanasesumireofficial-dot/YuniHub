import { basicSetup, EditorView } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { lua } from '@codemirror/legacy-modes/mode/lua';

const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--text)', fontSize: '12px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--faint)', borderRight: '1px solid var(--line)' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,.035)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,.035)' },
  '.cm-cursor': { borderLeftColor: 'var(--a1)' }
});

export function createScriptEditor(parent, detail) {
  const extensions = [basicSetup, EditorView.editable.of(false), editorTheme];
  if (/\.(lua|luau)$/i.test(detail.script.name)) extensions.push(StreamLanguage.define(lua));
  return new EditorView({ doc: detail.text, extensions, parent });
}