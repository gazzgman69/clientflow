import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
  Hash,
  List,
  ListOrdered,
  Quote,
  Link2,
  Type,
  Trash2,
  Heading1,
  Heading2,
} from 'lucide-react';
import tippy from 'tippy.js';

interface CommandItemProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: () => void;
}

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface CommandListProps {
  items: CommandItemProps[];
  command: (item: CommandItemProps) => void;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <Card className="w-72 max-h-80 overflow-auto">
      <CardContent className="p-2">
        {props.items.length ? (
          props.items.map((item, index) => (
            <button
              className={cn(
                'flex items-center gap-2 w-full p-2 text-left rounded-md hover:bg-muted transition-colors',
                index === selectedIndex ? 'bg-muted' : 'transparent'
              )}
              key={index}
              onClick={() => selectItem(index)}
            >
              <div className="flex-shrink-0">{item.icon}</div>
              <div className="flex-1 overflow-hidden">
                <p className="font-medium text-sm truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
            </button>
          ))
        ) : (
          <div className="p-2 text-muted-foreground text-sm">No results</div>
        )}
      </CardContent>
    </Card>
  );
});

CommandList.displayName = 'CommandList';

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        allowSpaces: false,
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const getSuggestionItems = ({ query }: { query: string }) => {
  const items: CommandItemProps[] = [
    {
      title: 'Heading 1',
      description: 'Large section heading',
      icon: <Heading1 className="w-4 h-4" />,
      command: () => {},
    },
    {
      title: 'Heading 2', 
      description: 'Medium section heading',
      icon: <Heading2 className="w-4 h-4" />,
      command: () => {},
    },
    {
      title: 'Bullet List',
      description: 'Create a bullet list',
      icon: <List className="w-4 h-4" />,
      command: () => {},
    },
    {
      title: 'Numbered List',
      description: 'Create a numbered list',
      icon: <ListOrdered className="w-4 h-4" />,
      command: () => {},
    },
    {
      title: 'Quote',
      description: 'Create a blockquote',
      icon: <Quote className="w-4 h-4" />,
      command: () => {},
    },
    {
      title: 'Link',
      description: 'Add a link',
      icon: <Link2 className="w-4 h-4" />,
      command: () => {},
    },
    {
      title: 'Clear Format',
      description: 'Remove all formatting',
      icon: <Trash2 className="w-4 h-4" />,
      command: () => {},
    },
  ];

  return items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );
};

export const renderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: any = null;

  return {
    onStart: (props: any) => {
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
    },

    onUpdate(props: any) {
      component?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      popup?.[0]?.setProps({
        getReferenceClientRect: props.clientRect,
      });
    },

    onKeyDown(props: any) {
      if (props.event.key === 'Escape') {
        popup?.[0]?.hide();
        return true;
      }

      return (component?.ref as any)?.onKeyDown(props);
    },

    onExit() {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
};