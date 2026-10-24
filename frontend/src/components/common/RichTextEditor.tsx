import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Code, Italic, Link2, List, ListOrdered, Strikethrough } from 'lucide-react';
import { normalizeHttpUrl } from '../../lib/cardHtml';

interface Props {
  /** Called on every change with the HTML and the plain text. */
  onChange: (html: string, text: string) => void;
  /** Ctrl/Cmd+Enter. */
  onSubmit: () => void;
  placeholder?: string;
  ariaLabel: string;
}

const isHttp = (u: string) => /^https?:\/\//i.test(u);

// Compact card editor: only the marks the server allows (see handlers/answer.go).
export const RichTextEditor: React.FC<Props> = ({ onChange, onSubmit, placeholder, ariaLabel }) => {
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [empty, setEmpty] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkErr, setLinkErr] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          protocols: ['http', 'https'],
          isAllowedUri: (url) => isHttp(url),
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'rte-content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel,
        'data-autofocus': '',
      },
      handleKeyDown: (_view, e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submitRef.current();
          return true;
        }
        return false;
      },
    },
    onCreate: ({ editor: ed }) => setEmpty(ed.isEmpty),
    onUpdate: ({ editor: ed }) => {
      setEmpty(ed.isEmpty);
      changeRef.current(ed.getHTML(), ed.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const t = window.setTimeout(() => editor.commands.focus('end'), 30);
    return () => window.clearTimeout(t);
  }, [editor]);

  const st = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: !!ed?.isActive('bold'),
      italic: !!ed?.isActive('italic'),
      strike: !!ed?.isActive('strike'),
      bullet: !!ed?.isActive('bulletList'),
      ordered: !!ed?.isActive('orderedList'),
      code: !!ed?.isActive('code'),
      link: !!ed?.isActive('link'),
    }),
  });

  useEffect(() => {
    if (linkOpen) linkInput.current?.focus();
  }, [linkOpen]);

  if (!editor) return null;

  const openLink = () => {
    setLinkValue((editor.getAttributes('link').href as string) || '');
    setLinkErr(false);
    setLinkOpen(true);
  };
  const closeLink = () => {
    setLinkOpen(false);
    editor.chain().focus().run();
  };
  const applyLink = () => {
    if (!linkValue.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const href = normalizeHttpUrl(linkValue);
    if (!href) {
      setLinkErr(true);
      return;
    }
    if (editor.state.selection.empty && !st?.link) {
      // No selection and no link under the caret: insert the URL itself as the link text.
      editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).insertContent(' ').run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const btn = (label: string, active: boolean, run: () => void, icon: React.ReactNode, hint: string) => (
    <button
      type="button"
      className="rte-btn"
      aria-label={label}
      aria-pressed={active}
      title={hint}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {icon}
    </button>
  );
  const ic = { size: 15, 'aria-hidden': true } as const;

  return (
    <div className="rte" data-empty={empty || undefined}>
      <div className="rte-bar" role="toolbar" aria-label="Format teks">
        {btn('Tebal', !!st?.bold, () => editor.chain().focus().toggleBold().run(), <Bold {...ic} />, 'Tebal (Ctrl+B)')}
        {btn('Miring', !!st?.italic, () => editor.chain().focus().toggleItalic().run(), <Italic {...ic} />, 'Miring (Ctrl+I)')}
        {btn('Coret', !!st?.strike, () => editor.chain().focus().toggleStrike().run(), <Strikethrough {...ic} />, 'Coret (Ctrl+Shift+S)')}
        <span className="rte-sep" aria-hidden="true" />
        {btn('Daftar poin', !!st?.bullet, () => editor.chain().focus().toggleBulletList().run(), <List {...ic} />, 'Daftar poin (Ctrl+Shift+8)')}
        {btn('Daftar angka', !!st?.ordered, () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered {...ic} />, 'Daftar angka (Ctrl+Shift+7)')}
        {btn('Kode', !!st?.code, () => editor.chain().focus().toggleCode().run(), <Code {...ic} />, 'Kode (Ctrl+E)')}
        <span className="rte-sep" aria-hidden="true" />
        {btn('Tautan', !!st?.link || linkOpen, () => (linkOpen ? closeLink() : openLink()), <Link2 {...ic} />, 'Tautan')}
      </div>
      {linkOpen && (
        <div className="rte-link">
          <input
            ref={linkInput}
            type="url"
            inputMode="url"
            className="inp sm"
            value={linkValue}
            onChange={(e) => {
              setLinkValue(e.target.value);
              setLinkErr(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                applyLink();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeLink();
              }
            }}
            placeholder="https://contoh.com"
            aria-label="Alamat tautan (http atau https)"
            aria-invalid={linkErr || undefined}
          />
          <button type="button" className="btn sm primary" onClick={applyLink}>
            Pasang
          </button>
          {st?.link && (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                setLinkOpen(false);
              }}
            >
              Hapus
            </button>
          )}
          {linkErr && <span className="rte-err">Hanya alamat http atau https.</span>}
        </div>
      )}
      <div className="rte-wrap">
        {placeholder && empty && (
          <span className="rte-ph" aria-hidden="true">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
