import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { forwardRef, useImperativeHandle, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { SlashCommand, getSuggestionItems, renderItems } from './slash-command';

interface RichTextEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  // Additional toolbar buttons
  onTokenInsert?: (insertToken: (token: string) => void) => React.ReactNode;
  onSignatureSelect?: () => React.ReactNode;
  onTemplateSelect?: () => React.ReactNode;
}

export interface RichTextEditorRef {
  insertText: (text: string) => void;
  getHTML: () => string;
  focus: () => void;
  setContent: (content: string) => void;
  insertToken: (token: string) => void;
  appendSignature: (signatureContent: string) => boolean;
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  (props, ref) => {
    const { content = '', onChange, placeholder = 'Start typing...', className = '', minHeight = '200px', disabled = false, onFocus, onBlur, onTokenInsert, onSignatureSelect, onTemplateSelect } = props;
    const contentId = useId();
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          // Disable extensions we're adding separately to avoid conflicts
          link: false,
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
        SlashCommand.configure({
          suggestion: {
            items: getSuggestionItems,
            render: renderItems,
            command: ({ editor, range, props }: any) => {
              const { title } = props;
              // Delete the slash and the command text
              editor.chain().focus().deleteRange(range).run();
              
              // Execute the appropriate command
              switch (title) {
                case 'Heading 1':
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                  break;
                case 'Heading 2':
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                  break;
                case 'Bullet List':
                  editor.chain().focus().toggleBulletList().run();
                  break;
                case 'Numbered List':
                  editor.chain().focus().toggleOrderedList().run();
                  break;
                case 'Quote':
                  editor.chain().focus().toggleBlockquote().run();
                  break;
                case 'Link':
                  const url = window.prompt('Enter the URL');
                  if (url) {
                    const sanitizedUrl = url.toLowerCase().startsWith('javascript:') ? '' : url;
                    if (sanitizedUrl) {
                      editor.chain().focus().setLink({ href: sanitizedUrl }).run();
                    }
                  }
                  break;
                case 'Clear Format':
                  editor.chain().focus().clearNodes().unsetAllMarks().run();
                  break;
                default:
                  break;
              }
            },
          },
        }),
      ],
      content,
      editorProps: {
        attributes: {
          class: cn(
            'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            'focus-within:border-primary',
            disabled && 'cursor-not-allowed opacity-50'
          ),
          style: `min-height: ${minHeight};`,
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': placeholder,
          'aria-disabled': disabled ? 'true' : 'false',
          id: contentId,
        },
        handleKeyDown: (view, event) => {
          // Handle keyboard shortcuts
          const { key, ctrlKey, metaKey, shiftKey } = event;
          const isCmd = ctrlKey || metaKey;

          // Bold: Ctrl/Cmd + B
          if (isCmd && key === 'b' && !shiftKey) {
            event.preventDefault();
            editor?.chain().focus().toggleBold().run();
            return true;
          }

          // Italic: Ctrl/Cmd + I
          if (isCmd && key === 'i' && !shiftKey) {
            event.preventDefault();
            editor?.chain().focus().toggleItalic().run();
            return true;
          }

          // Underline: Ctrl/Cmd + U
          if (isCmd && key === 'u' && !shiftKey) {
            event.preventDefault();
            editor?.chain().focus().toggleUnderline().run();
            return true;
          }

          // Link: Ctrl/Cmd + K
          if (isCmd && key === 'k' && !shiftKey) {
            event.preventDefault();
            const url = window.prompt('Enter the URL');
            if (url) {
              const sanitizedUrl = url.toLowerCase().startsWith('javascript:') ? '' : url;
              if (sanitizedUrl) {
                editor?.chain().focus().setLink({ href: sanitizedUrl }).run();
              }
            }
            return true;
          }

          return false;
        },
        handlePaste: (view, event, slice) => {
          // Handle paste - strip unsafe HTML while keeping basic formatting
          const { clipboardData } = event;
          if (!clipboardData) return false;

          const text = clipboardData.getData('text/plain');
          const html = clipboardData.getData('text/html');

          // If there's HTML content, sanitize it
          if (html && html !== text) {
            event.preventDefault();
            
            // Create a temporary element to parse HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // Remove potentially dangerous elements and attributes
            const dangerous = temp.querySelectorAll('script, style, iframe, object, embed');
            dangerous.forEach(el => el.remove());
            
            // Remove all event handlers and javascript: links
            temp.querySelectorAll('*').forEach(el => {
              Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
                  el.removeAttribute(attr.name);
                }
              });
            });

            // Insert the sanitized HTML
            const sanitizedHtml = temp.innerHTML;
            editor?.commands.insertContent(sanitizedHtml);
            return true;
          }

          return false;
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
      insertToken: (token: string) => {
        if (editor) {
          // Insert token at current cursor position
          editor.chain().focus().insertContent(token + ' ').run();
        }
      },
      appendSignature: (signatureContent: string) => {
        if (!editor) return false;
        
        // Get current content
        const currentHTML = editor.getHTML();
        
        // Check if signature already exists (look for the signature content in current HTML)
        // Remove HTML tags for comparison
        const currentText = currentHTML.replace(/<[^>]*>/g, '').trim();
        const signatureText = signatureContent.replace(/<[^>]*>/g, '').trim();
        
        if (currentText.includes(signatureText)) {
          // Signature already exists, don't add it again
          return false;
        }
        
        // Move cursor to the end and append signature
        const { to } = editor.state.selection;
        const endPosition = editor.state.doc.content.size;
        editor.chain()
          .focus()
          .setTextSelection(endPosition)
          .insertContent(`<p></p><p></p>${signatureContent}`)
          .run();
        
        return true;
      },
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
      <TooltipProvider>
        <div className={cn('w-full', className)}>
          {/* Toolbar */}
          <div 
            className="flex flex-wrap items-center gap-1 p-2 border border-input rounded-t-md bg-muted/30 dark:bg-muted/20 max-w-full overflow-hidden sm:flex-row" 
            role="toolbar" 
            aria-label="Text formatting toolbar"
            aria-controls={contentId}
            aria-disabled={disabled}
          >
          {/* Text formatting */}
          <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={editor.isActive('bold')}
                  onPressedChange={() => editor.chain().focus().toggleBold().run()}
                  disabled={disabled}
                  aria-label="Bold"
                  data-testid="rte-bold"
                >
                  <Bold className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bold (Ctrl+B)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={editor.isActive('italic')}
                  onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                  disabled={disabled}
                  aria-label="Italic"
                  data-testid="rte-italic"
                >
                  <Italic className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Italic (Ctrl+I)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={editor.isActive('underline')}
                  onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
                  disabled={disabled}
                  aria-label="Underline"
                  data-testid="rte-underline"
                >
                  <UnderlineIcon className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Underline (Ctrl+U)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* Link */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={addLink}
                disabled={disabled}
                className={cn(editor.isActive('link') && 'bg-muted dark:bg-muted/70')}
                aria-label="Add Link"
                data-testid="rte-link"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add Link (Ctrl+K)</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* Lists */}
          <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={editor.isActive('bulletList')}
                  onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                  disabled={disabled}
                  aria-label="Bullet List"
                  data-testid="rte-bullet-list"
                >
                  <List className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bullet List</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={editor.isActive('orderedList')}
                  onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                  disabled={disabled}
                  aria-label="Numbered List"
                  data-testid="rte-ordered-list"
                >
                  <ListOrdered className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Numbered List</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* Block elements */}
          <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={editor.isActive('blockquote')}
                  onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                  disabled={disabled}
                  aria-label="Quote"
                  data-testid="rte-blockquote"
                >
                  <Quote className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Quote Block</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={editor.isActive('code')}
                  onPressedChange={() => editor.chain().focus().toggleCode().run()}
                  disabled={disabled}
                  aria-label="Inline Code"
                  data-testid="rte-code"
                >
                  <Code className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Inline Code</p>
              </TooltipContent>
            </Tooltip>

            {/* Insert Token, Signature, Template - inline with main formatting buttons */}
            {onTokenInsert && onTokenInsert((token) => {
              if (editor) {
                editor.chain().focus().insertContent(token + ' ').run();
              }
            })}
            {onSignatureSelect && onSignatureSelect()}
            {onTemplateSelect && onTemplateSelect()}
            
            {/* Undo/Redo - smaller size, inline with main formatting buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={disabled || !editor.can().undo()}
                  aria-label="Undo"
                  data-testid="rte-undo"
                  className="h-7 w-7 p-0"
                >
                  <Undo className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Undo (Ctrl+Z)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={disabled || !editor.can().redo()}
                  aria-label="Redo"
                  data-testid="rte-redo"
                  className="h-7 w-7 p-0"
                >
                  <Redo className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo (Ctrl+Y)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Editor content */}
        <EditorContent
          editor={editor}
          className="rounded-b-md border-x border-b border-input dark:border-input"
        />
      </div>
      </TooltipProvider>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export { RichTextEditor };