import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Code,
  Undo,
  Redo
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { TokenDropdown } from '@/components/ui/token-dropdown';
import FormFieldDropdown from '@/components/contracts/form-field-dropdown';

interface FormField {
  id: string;
  type: 'checkbox' | 'text_input' | 'long_text_input' | 'initials' | 'signature';
  label: string;
  required: boolean;
}

interface ContractEditorProps {
  content: string;
  onChange: (html: string) => void;
  formFields?: FormField[];
  onFormFieldsChange?: (fields: FormField[]) => void;
  showFormButton?: boolean;
}

export default function ContractEditor({ 
  content, 
  onChange,
  formFields = [],
  onFormFieldsChange,
  showFormButton = true
}: ContractEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[400px] max-w-none p-4',
      },
    },
  }, []);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const insertToken = (token: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(token).run();
  };

  const insertFormField = (field: FormField) => {
    if (!editor) return;
    
    // Add field to formFields array
    if (onFormFieldsChange) {
      onFormFieldsChange([...formFields, field]);
    }
    
    // Insert placeholder in editor
    const placeholder = `[FORM:${field.id}]`;
    editor.chain().focus().insertContent(placeholder).run();
  };

  return (
    <div className="border rounded-lg">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b border-t bg-background shadow-sm p-2 flex flex-wrap gap-1 items-center">
        <Toggle
          size="sm"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Toggle bold"
          data-testid="editor-bold"
        >
          <Bold className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Toggle italic"
          data-testid="editor-italic"
        >
          <Italic className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Toggle underline"
          data-testid="editor-underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={addLink}
          className="h-8"
          data-testid="editor-link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Toggle
          size="sm"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Toggle bullet list"
          data-testid="editor-bullet-list"
        >
          <List className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Toggle ordered list"
          data-testid="editor-ordered-list"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('blockquote')}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Toggle quote"
          data-testid="editor-blockquote"
        >
          <Quote className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('code')}
          onPressedChange={() => editor.chain().focus().toggleCode().run()}
          aria-label="Toggle code"
          data-testid="editor-code"
        >
          <Code className="h-4 w-4" />
        </Toggle>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
          aria-label="Undo"
          data-testid="editor-undo"
        >
          <Undo className="h-3 w-3" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
          aria-label="Redo"
          data-testid="editor-redo"
        >
          <Redo className="h-3 w-3" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />
        
        <TokenDropdown onTokenSelect={insertToken} size="sm" />

        {showFormButton && <FormFieldDropdown onInsert={insertFormField} />}
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}
