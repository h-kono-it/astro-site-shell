import type { FileEntry, Collection } from './types.js';
import { buildFs, resolvePath, esc, fmtDate } from './fs.js';

export interface TerminalOptions {
  pages?: FileEntry[];
  collections?: Collection[];
  promptLabel?: string;
  disabledCommands?: string[];
}

interface CommandDef {
  names: string[];
  run: (args: string[], cmd: string) => void;
  helpRows?: [string, string][];
}

export class Terminal {
  private outputEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private promptEl: HTMLElement;
  private termEl: HTMLElement;

  private fs: ReturnType<typeof buildFs>;
  private cwd = '/';
  private cmdHistory: string[] = [];
  private historyIdx = -1;
  private disabled: Set<string>;
  private promptLabel: string;

  private commandDefs: CommandDef[] = [];
  private commandLookup = new Map<string, CommandDef>();

  constructor(root: HTMLElement, opts: TerminalOptions = {}) {
    const {
      pages = [],
      collections = [],
      promptLabel = 'user@site',
      disabledCommands = [],
    } = opts;

    this.termEl    = root;
    this.outputEl  = root.querySelector('.terminal-output')!;
    this.inputEl   = root.querySelector<HTMLInputElement>('.terminal-input')!;
    this.promptEl  = root.querySelector('.terminal-prompt')!;
    this.fs        = buildFs(pages, collections);
    this.promptLabel = promptLabel;
    this.disabled  = new Set(disabledCommands);

    this.commandDefs = this.buildCommandDefs();
    for (const def of this.commandDefs) {
      for (const name of def.names) this.commandLookup.set(name, def);
    }

    this.appendLine("Welcome to the terminal. Type 'help' for available commands.", 'ol-muted');
    this.appendLine('', '');
    this.promptEl.textContent = this.promptText();

    this.inputEl.addEventListener('keydown', this.onKeydown);
    this.termEl.addEventListener('click', this.onClick);
  }

  destroy(): void {
    this.inputEl.removeEventListener('keydown', this.onKeydown);
    this.termEl.removeEventListener('click', this.onClick);
  }

  private promptText() {
    return `${this.promptLabel}:${this.cwd === '/' ? '~' : '~' + this.cwd}$`;
  }

  private appendLine(text: string, cls?: string) {
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.textContent = text;
    this.outputEl.appendChild(el);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  private appendHtml(html: string, cls?: string) {
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.innerHTML = html;
    this.outputEl.appendChild(el);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  private echoInput(val: string) {
    this.appendHtml(`<span style="color:#7dff7d">${esc(this.promptText())}</span> ${esc(val)}`);
  }

  private resolveArg(arg: string) {
    const slash = arg.lastIndexOf('/');
    if (slash === -1) return { dir: this.cwd, file: arg };
    const dir = resolvePath(this.cwd, arg.slice(0, slash) || '/');
    return { dir, file: arg.slice(slash + 1) };
  }

  private cmdHelp() {
    this.commandDefs
      .filter(d => d.helpRows && !d.names.some(n => this.disabled.has(n)))
      .forEach(({ helpRows }) => {
        helpRows!.forEach(([c, d]) => {
          this.appendHtml(`  <span class="ol-file">${esc(c)}</span> <span class="ol-muted">— ${esc(d)}</span>`);
        });
      });
  }

  private cmdLs(args: string[]) {
    const long = args.some(a => /^-l/.test(a));
    const dirArg = args.find(a => !a.startsWith('-'));
    const dir = dirArg ? resolvePath(this.cwd, dirArg) : this.cwd;
    const target = this.fs[dir];
    if (!target) { this.appendLine(`ls: ${dirArg}: no such directory`, 'ol-err'); return; }

    if (long) {
      target.dirs.forEach(d => {
        this.appendHtml(`  <span class="ol-muted">d</span>  <span class="ol-muted">          </span>  <span class="ol-dir">${esc(d)}/</span>`);
      });
      target.files.forEach(f => {
        const date = fmtDate(f.pubDate) ?? '          ';
        this.appendHtml(`  <span class="ol-muted">f</span>  <span class="ol-muted">${date}</span>  <span class="ol-file">${esc(f.name)}</span> <span class="ol-muted">— ${esc(f.title)}</span>`);
      });
    } else {
      target.dirs.forEach(d => this.appendLine(`  ${d}/`, 'ol-dir'));
      target.files.forEach(f => {
        this.appendHtml(`  <span class="ol-file">${esc(f.name)}</span> <span class="ol-muted">— ${esc(f.title)}</span>`);
      });
    }
    if (!target.dirs.length && !target.files.length) this.appendLine('  (empty)', 'ol-muted');
  }

  private cmdCd(target: string | undefined) {
    const next = resolvePath(this.cwd, target ?? '~');
    if (!this.fs[next]) {
      this.appendLine(`cd: no such directory: ${target}`, 'ol-err');
      return;
    }
    this.cwd = next;
    this.promptEl.textContent = this.promptText();
  }

  private cmdOpen(name: string | undefined) {
    if (!name) { this.appendLine('open: missing argument', 'ol-err'); return; }
    const { dir, file } = this.resolveArg(name);
    const target = this.fs[dir];
    if (!target) { this.appendLine(`open: ${name}: no such directory`, 'ol-err'); return; }
    const found = target.files.find(f => f.name === file);
    if (found) {
      this.appendLine(`  → ${found.url}`, 'ol-muted');
      window.open(found.url, '_blank', 'noopener,noreferrer');
    } else {
      this.appendLine(`open: ${name}: not found`, 'ol-err');
    }
  }

  private cmdCat(name: string | undefined, cmd: string) {
    if (!name) { this.appendLine(`${cmd}: missing argument`, 'ol-err'); return; }
    const { dir, file } = this.resolveArg(name);
    const target = this.fs[dir];
    if (!target) { this.appendLine(`${cmd}: ${name}: no such file or directory`, 'ol-err'); return; }
    const found = target.files.find(f => f.name === file);
    if (!found) {
      if (this.fs[resolvePath(this.cwd, name)]) {
        this.appendLine(`${cmd}: ${name}: is a directory  (use 'ls' to list contents)`, 'ol-err');
      } else {
        this.appendLine(`${cmd}: ${name}: no such file`, 'ol-err');
      }
      return;
    }
    if (!found.body) {
      this.appendLine(`  (no content — try 'open ${name}')`, 'ol-muted');
      return;
    }
    this.appendLine(`  ── ${found.title} ──`, 'ol-muted');
    found.body.split('\n').forEach(line => this.appendLine(line));
  }

  private cmdGrep(args: string[]) {
    const kw = args.join(' ').toLowerCase();
    if (!kw) { this.appendLine('grep: missing keyword', 'ol-err'); return; }
    let found = 0;
    Object.entries(this.fs).forEach(([path, n]) => {
      n.files.forEach(f => {
        const haystack = [f.title, f.name, ...(f.tags ?? []), f.body ?? ''].join('\n').toLowerCase();
        if (haystack.includes(kw)) {
          const p = path === '/' ? f.name : `${path.slice(1)}/${f.name}`;
          this.appendHtml(`  <span class="ol-file">${esc(p)}</span> <span class="ol-muted">— ${esc(f.title)}</span>`);
          found++;
        }
      });
    });
    if (!found) this.appendLine(`  (no matches for "${args.join(' ')}")`, 'ol-muted');
  }

  private cmdFind(args: string[]) {
    const ni = args.indexOf('-name');
    if (ni === -1 || !args[ni + 1]) {
      this.appendLine('find: usage: find -name <pattern>', 'ol-err');
      return;
    }
    const pat = args[ni + 1].replace(/^['"]|['"]$/g, '');
    const reStr = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp(`^${reStr}$`, 'i');
    let found = 0;
    const base = this.cwd;
    Object.entries(this.fs).forEach(([path, n]) => {
      if (path !== base && !path.startsWith(base === '/' ? '/' : base + '/')) return;
      n.files.forEach(f => {
        if (re.test(f.name)) {
          const rel = '.' + (path === '/' ? '' : path) + '/' + f.name;
          this.appendLine(`  ${rel}`, 'ol-file');
          found++;
        }
      });
    });
    if (!found) this.appendLine(`  (no matches for "${pat}")`, 'ol-muted');
  }

  private cmdSl() {
    const art = [
      '      ====        ________                ___________',
      '  _D _|  |_______/        \\__I_I_____===__|_________|',
      '   |(_)---  |   H\\________/ |   |        =|___ ___|      _________________',
      '   /     |  |   H  |  |     |   |         ||_| |_||     _|                \\_____A',
      '  |      |  |   H  |__--------------------| [___] |   =|                        |',
      '  | ________|___H__/__|_____/[][]~\\_______|       |   -|                        |',
      '  |/ |   |-----------I_____I [][] []  D   |=======|____|________________________|_',
      '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__|__________________________|_',
      ' |/-=|___|=    ||    ||    ||    |_____/~\\___/          |_D__D__D_|  |_D__D__D_|',
      '  \\_/      \\O=====O=====O=====O_/      \\_/               \\_/   \\_/    \\_/   \\_/',
    ].join('\n');

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;overflow:hidden;height:16.5em;width:100%;';

    const pre = document.createElement('pre');
    pre.style.cssText = 'position:absolute;white-space:pre;color:#c8d0e0;margin:0;left:100%;animation:sl-train 8s linear forwards;';
    pre.textContent = art;
    wrapper.appendChild(pre);

    if (!document.getElementById('sl-anim-style')) {
      const s = document.createElement('style');
      s.id = 'sl-anim-style';
      s.textContent = '@keyframes sl-train{from{left:100%}to{left:-500%}}';
      document.head.appendChild(s);
    }

    this.outputEl.appendChild(wrapper);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
    pre.addEventListener('animationend', () => wrapper.remove(), { once: true });
  }

  private buildCommandDefs(): CommandDef[] {
    return [
      {
        names: ['help'],
        run: () => this.cmdHelp(),
        helpRows: [['help', 'コマンド一覧を表示']],
      },
      {
        names: ['ls'],
        run: (a) => this.cmdLs(a),
        helpRows: [
          ['ls',    '現在の階層の一覧を表示'],
          ['ls -l', '種別・公開日付きで表示'],
        ],
      },
      {
        names: ['cd'],
        run: (a) => this.cmdCd(a[0]),
        helpRows: [
          ['cd <dir>', 'ディレクトリを移動'],
          ['cd ..',    '親ディレクトリに移動'],
        ],
      },
      {
        names: ['cat', 'view'],
        run: (a, cmd) => this.cmdCat(a[0], cmd),
        helpRows: [['cat/view <name>', '記事の内容を表示']],
      },
      {
        names: ['open'],
        run: (a) => this.cmdOpen(a[0]),
        helpRows: [['open <name>', 'ページ・記事を新しいタブで開く']],
      },
      {
        names: ['grep'],
        run: (a) => this.cmdGrep(a),
        helpRows: [['grep <keyword>', 'タイトル・本文をキーワード検索']],
      },
      {
        names: ['find'],
        run: (a) => this.cmdFind(a),
        helpRows: [['find -name <glob>', 'パターンで記事を検索（例: *java*）']],
      },
      {
        names: ['pwd'],
        run: () => this.appendLine(this.cwd === '/' ? '/' : this.cwd),
      },
      {
        names: ['sl'],
        run: () => this.cmdSl(),
      },
      {
        names: ['clear'],
        run: () => { this.outputEl.innerHTML = ''; },
        helpRows: [['clear', '画面をクリア']],
      },
    ];
  }

  private execute(raw: string) {
    const input = raw.trim();
    if (!input) return;
    this.cmdHistory.unshift(input);
    this.historyIdx = -1;
    this.echoInput(input);

    const [cmd, ...args] = input.split(/\s+/);
    const def = this.commandLookup.get(cmd);
    if (!def || this.disabled.has(cmd)) {
      this.appendLine(`${cmd}: command not found  (type 'help' for commands)`, 'ol-err');
      return;
    }
    def.run(args, cmd);
  }

  private tabComplete(val: string): string {
    const parts = val.trimStart().split(/\s+/);
    const cmd = parts[0];
    const arg = parts[1] ?? '';

    if (parts.length === 1) {
      const allNames = [...this.commandLookup.keys()].filter(c => !this.disabled.has(c));
      const ms = allNames.filter(c => c.startsWith(cmd));
      if (ms.length === 1) return ms[0] + ' ';
      if (ms.length > 1) { this.echoInput(val); this.appendLine('  ' + ms.join('  '), 'ol-muted'); }
      return val;
    }

    if (cmd === 'cd' || cmd === 'ls') {
      const dirArg = parts.slice(1).find(p => !p.startsWith('-')) ?? '';
      const slash = dirArg.lastIndexOf('/');
      const dirPart = slash === -1 ? this.cwd : resolvePath(this.cwd, dirArg.slice(0, slash) || '/');
      const prefix  = slash === -1 ? dirArg : dirArg.slice(slash + 1);
      const pathPrefix = slash === -1 ? '' : dirArg.slice(0, slash + 1);
      const targetNode = this.fs[dirPart];
      if (!targetNode) return val;
      const ms = targetNode.dirs.filter(d => d.startsWith(prefix));
      const flags = parts.slice(1).filter(p => p.startsWith('-')).join(' ');
      const flagStr = flags ? flags + ' ' : '';
      if (ms.length === 1) return `${cmd} ${flagStr}${pathPrefix}${ms[0]}/`;
      if (ms.length > 1) { this.echoInput(val); this.appendLine('  ' + ms.join('  '), 'ol-muted'); }
      return val;
    }

    if (cmd === 'cat' || cmd === 'view' || cmd === 'open') {
      const { dir, file: prefix } = this.resolveArg(arg);
      const targetNode = this.fs[dir];
      if (!targetNode) return val;
      const pathPrefix = arg.includes('/') ? arg.slice(0, arg.lastIndexOf('/') + 1) : '';
      const fileMs = targetNode.files.map(f => f.name).filter(n => n.startsWith(prefix));
      const dirMs  = targetNode.dirs.filter(d => d.startsWith(prefix));
      if (fileMs.length === 1 && dirMs.length === 0) return `${cmd} ${pathPrefix}${fileMs[0]}`;
      if (dirMs.length === 1  && fileMs.length === 0) return `${cmd} ${pathPrefix}${dirMs[0]}/`;
      const all = [...dirMs.map(d => d + '/'), ...fileMs];
      if (all.length > 1) { this.echoInput(val); this.appendLine('  ' + all.join('  '), 'ol-muted'); }
      return val;
    }

    return val;
  }

  private onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const val = this.inputEl.value;
      this.inputEl.value = '';
      this.execute(val);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.inputEl.value = this.tabComplete(this.inputEl.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.historyIdx < this.cmdHistory.length - 1) {
        this.historyIdx++;
        this.inputEl.value = this.cmdHistory[this.historyIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historyIdx > 0) {
        this.historyIdx--;
        this.inputEl.value = this.cmdHistory[this.historyIdx];
      } else {
        this.historyIdx = -1;
        this.inputEl.value = '';
      }
    }
  };

  private onClick = () => {
    if (window.getSelection()?.toString()) return;
    this.inputEl.focus();
  };
}
