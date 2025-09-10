import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link2,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
} from 'lucide-react';

interface RichTextEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface RichTextEditorRef {
  insertText: (text: string) => void;
  getHTML: () => string;
  focus: () => void;
  setContent: (content: string) => void;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ content = '', onChange, placeholder = 'Start typing...', className = '', minHeight = '200px', disabled = false, onFocus, onBlur }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          bulletList: {
            HTMLAttributes: {
              class: 'list-disc list-outside leading-3 -mt-2',
            },
          },
          orderedList: {
            HTMLAttributes: {
              class: 'list-decimal list-outside leading-3 -mt-2',
            },
          },
          listItem: {
            HTMLAttributes: {
              class: 'leading-normal -mb-2',
            },
          },
          blockquote: {
            HTMLAttributes: {
              class: 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic',
            },
          },
          code: {
            HTMLAttributes: {
              class: 'bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 font-mono text-sm',
            },
          },
          codeBlock: {
            HTMLAttributes: {
              class: 'bg-gray-100 dark:bg-gray-800 rounded p-4 font-mono text-sm overflow-x-auto',
            },
          },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-blue-500 dark:text-blue-400 underline cursor-pointer',
          },
        }),
        Placeholder.configure({
          placeholder,
        }),
        Typography,
        Underline,
        TextStyle,
      ],
      content,
      editorProps: {
        attributes: {
          class: cn(
            'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
            'min-h-[' + minHeight + '] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-50'
          ),
        },
      },
      onUpdate: ({ editor }) => {
        onChange?.(editor.getHTML());
      },
      onFocus: () => {
        onFocus?.();
      },
      onBlur: () => {
        onBlur?.();
      },
      editable: !disabled,
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        if (editor) {
          editor.chain().focus().insertContent(text).run();
        }
      },
      getHTML: () => editor?.getHTML() || '',
      focus: () => editor?.commands.focus(),
      setContent: (content: string) => editor?.commands.setContent(content),
    }), [editor]);

    if (!editor) {
      return null;
    }

    const addLink = () => {
      const url = window.prompt('Enter the URL');
      if (url) {
        // Sanitize URL to prevent javascript: URLs
        const sanitizedUrl = url.toLowerCase().startsWith('javascript:') ? '' : url;
        if (sanitizedUrl) {
          editor.chain().focus().extendMarkRange('link').setLink({ href: sanitizedUrl }).run();
        }
      }
    };

    return (
      <div className={cn('w-full', className)}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 p-2 border border-input rounded-t-md bg-muted/30">
          {/* Text formatting */}
          <div className="flex items-center gap-1">
            <Toggle
              size="sm"
              pressed={editor.isActive('bold')}
              onPressedChange={() => editor.chain().focus().toggleBold().run()}
              aria-label="Bold"
              data-testid="rte-bold"
            >
              <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor.isActive('italic')}
              onPressedChange={() => editor.chain().focus().toggleItalic().run()}
              aria-label="Italic"
              data-testid="rte-italic"
            >
              <Italic className="h-4 w-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor.isActive('underline')}
              onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
              aria-label="Underline"
              data-testid="rte-underline"
            >
              <UnderlineIcon className="h-4 w-4" />
            </Toggle>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Link */}
          <Button
            size="sm"
            variant="ghost"
            onClick={addLink}
            className={cn(editor.isActive('link') && 'bg-muted')}
            aria-label="Add Link"
            data-testid="rte-link"
          >
            <Link2 className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Lists */}
          <div className="flex items-center gap-1">
            <Toggle
              size="sm"
              pressed={editor.isActive('bulletList')}
              onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
              aria-label="Bullet List"
              data-testid="rte-bullet-list"
            >
              <List className="h-4 w-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor.isActive('orderedList')}
              onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
              aria-label="Numbered List"
              data-testid="rte-ordered-list"
            >
              <ListOrdered className="h-4 w-4" />
            </Toggle>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Block elements */}
          <div className="flex items-center gap-1">
            <Toggle
              size="sm"
              pressed={editor.isActive('blockquote')}
              onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
              aria-label="Quote"
              data-testid="rte-blockquote"
            >
              <Quote className="h-4 w-4" />
            </Toggle>
            <Toggle
              size="sm"
              pressed={editor.isActive('code')}
              onPressedChange={() => editor.chain().focus().toggleCode().run()}
              aria-label="Inline Code"
              data-testid="rte-code"
            >
              <Code className="h-4 w-4" />
            </Toggle>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              aria-label="Undo"
              data-testid="rte-undo"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              aria-label="Redo"
              data-testid="rte-redo"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Editor content */}
        <EditorContent
          editor={editor}
          className="rounded-b-md"
        />
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';