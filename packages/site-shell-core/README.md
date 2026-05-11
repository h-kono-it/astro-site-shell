# site-shell-core

Framework-agnostic core logic for the [astro-site-shell](https://www.npmjs.com/package/astro-site-shell) terminal widget.

If you're using Astro, use `astro-site-shell` instead. This package is for integrating the terminal into other frameworks such as Vue, React, Svelte, or vanilla JS.

## Install

```bash
npm install site-shell-core
```

## Usage

### `attachTerminal(opts)`

Pass references to DOM elements and the terminal is ready to go.

```ts
import { attachTerminal } from 'site-shell-core';
import 'site-shell-core/styles/terminal.css';

const handle = attachTerminal({
  root:         document.getElementById('terminal'),
  output:       document.getElementById('terminal-output'),
  input:        document.getElementById('terminal-input'),
  prompt:       document.getElementById('terminal-prompt'),
  promptLabel:  'you@mysite',
  pages: [
    { name: 'about', url: '/about', title: 'About' },
  ],
  collections: [
    {
      name: 'posts',
      entries: [
        { name: 'hello', url: '/posts/hello', title: 'Hello World' },
      ],
    },
  ],
});

// Clean up
handle.destroy();
```

### Options (`AttachOptions`)

| Field | Type | Required | Description |
|---|---|---|---|
| `root` | `HTMLElement` | ✓ | Root element of the terminal (click to focus) |
| `output` | `HTMLElement` | ✓ | Element where output lines are appended |
| `input` | `HTMLInputElement` | ✓ | Command input field |
| `prompt` | `HTMLElement` | ✓ | Element displaying the prompt label |
| `promptLabel` | `string` | — | Prompt string (default: `'user@site'`) |
| `pages` | `FileEntry[]` | — | Top-level pages |
| `collections` | `Collection[]` | — | Collections, each mapped to a subdirectory |
| `disabledCommands` | `string[]` | — | Commands to disable (e.g. `['sl', 'open']`) |

### `TerminalHandle`

Return value of `attachTerminal`.

| Method | Description |
|---|---|
| `destroy()` | Remove all event listeners |

## Framework examples

### Vue 3

```vue
<template>
  <div ref="termRef" class="terminal" @click="inputRef?.focus()">
    <div ref="outputRef" class="terminal-output"></div>
    <div class="terminal-input-row">
      <span ref="promptRef" class="terminal-prompt"></span>
      <input ref="inputRef" type="text" class="terminal-input" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { attachTerminal, type TerminalHandle } from 'site-shell-core';
import 'site-shell-core/styles/terminal.css';

const props = defineProps<{ promptLabel?: string }>();

const termRef   = ref<HTMLElement>();
const outputRef = ref<HTMLElement>();
const inputRef  = ref<HTMLInputElement>();
const promptRef = ref<HTMLElement>();

let handle: TerminalHandle;

onMounted(() => {
  handle = attachTerminal({
    root:        termRef.value!,
    output:      outputRef.value!,
    input:       inputRef.value!,
    prompt:      promptRef.value!,
    promptLabel: props.promptLabel,
  });
});

onUnmounted(() => handle?.destroy());
</script>
```

### React

```tsx
import { useEffect, useRef } from 'react';
import { attachTerminal, type TerminalHandle } from 'site-shell-core';
import 'site-shell-core/styles/terminal.css';

export function Terminal({ promptLabel }: { promptLabel?: string }) {
  const termRef   = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handle: TerminalHandle = attachTerminal({
      root:        termRef.current!,
      output:      outputRef.current!,
      input:       inputRef.current!,
      prompt:      promptRef.current!,
      promptLabel,
    });
    return () => handle.destroy();
  }, []);

  return (
    <div ref={termRef} className="terminal" onClick={() => inputRef.current?.focus()}>
      <div ref={outputRef} className="terminal-output"></div>
      <div className="terminal-input-row">
        <span ref={promptRef} className="terminal-prompt"></span>
        <input ref={inputRef} type="text" className="terminal-input" />
      </div>
    </div>
  );
}
```

## CSS

`site-shell-core/styles/terminal.css` includes color classes for output lines (`.ol-dir` / `.ol-file` / `.ol-err` / `.ol-muted`) and the animation for the `sl` command. Container styles (`.terminal`, etc.) are left to each framework's implementation.

## License

MIT
