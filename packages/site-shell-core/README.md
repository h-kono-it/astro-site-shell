# site-shell-core

Framework-agnostic core logic for the [astro-site-shell](https://www.npmjs.com/package/astro-site-shell) terminal widget.

If you're using Astro, use `astro-site-shell` instead. This package is for integrating the terminal into other frameworks such as Vue, React, Svelte, or vanilla JS.

## Demo

**[Live Demo](https://h-kono-it.github.io/astro-site-shell/)**

## Install

```bash
npm install site-shell-core
```

## Usage

### `new Terminal(root, opts?)`

Pass the root element and options — the terminal queries `.terminal-output`, `.terminal-input`, and `.terminal-prompt` internally.

```ts
import { Terminal } from 'site-shell-core';
import 'site-shell-core/styles/terminal.css';

const terminal = new Terminal(document.getElementById('terminal'), {
  promptLabel: 'you@mysite',
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
terminal.destroy();
```

### Options (`TerminalOptions`)

| Field | Type | Required | Description |
|---|---|---|---|
| `promptLabel` | `string` | — | Prompt string (default: `'user@site'`) |
| `pages` | `FileEntry[]` | — | Top-level pages |
| `collections` | `Collection[]` | — | Collections, each mapped to a subdirectory |
| `disabledCommands` | `string[]` | — | Commands to disable (e.g. `['sl', 'open']`) |
| `customCommands` | `CustomCommand[]` | — | Custom commands to register at init |

### `Terminal` instance

| Method | Description |
|---|---|
| `destroy()` | Remove all event listeners |
| `addCommand(cmd)` | Register a custom command at runtime |

### `CustomCommand`

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✓ | Command name |
| `run` | `(args: string[]) => string \| string[] \| void` | ✓ | Handler. Return a string or string[] to print output |
| `description` | `string` | — | Description shown in `help` |

## HTML structure

The root element must contain these three child elements:

```html
<div id="terminal">
  <div class="terminal-output"></div>
  <div class="terminal-input-row">
    <span class="terminal-prompt"></span>
    <input type="text" class="terminal-input" />
  </div>
</div>
```

## Framework examples

### Vue 3

```vue
<template>
  <div ref="termRef" class="terminal">
    <div class="terminal-output"></div>
    <div class="terminal-input-row">
      <span class="terminal-prompt"></span>
      <input type="text" class="terminal-input" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Terminal } from 'site-shell-core';
import 'site-shell-core/styles/terminal.css';

const props = defineProps<{ promptLabel?: string }>();
const termRef = ref<HTMLElement>();
let terminal: Terminal;

onMounted(() => {
  terminal = new Terminal(termRef.value!, { promptLabel: props.promptLabel });
});

onUnmounted(() => terminal?.destroy());
</script>
```

### React

```tsx
import { useEffect, useRef } from 'react';
import { Terminal } from 'site-shell-core';
import 'site-shell-core/styles/terminal.css';

export function TerminalWidget({ promptLabel }: { promptLabel?: string }) {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const terminal = new Terminal(termRef.current!, { promptLabel });
    return () => terminal.destroy();
  }, []);

  return (
    <div ref={termRef} className="terminal">
      <div className="terminal-output"></div>
      <div className="terminal-input-row">
        <span className="terminal-prompt"></span>
        <input type="text" className="terminal-input" />
      </div>
    </div>
  );
}
```

## CSS

`site-shell-core/styles/terminal.css` includes color classes for output lines (`.ol-dir` / `.ol-file` / `.ol-err` / `.ol-muted`) and the animation for the `sl` command. Container styles (`.terminal`, etc.) are left to each framework's implementation.

## License

MIT
