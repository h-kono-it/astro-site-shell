import type { FileEntry, Collection } from './types.js';
import { buildFs, resolvePath, esc, fmtDate } from './fs.js';

export interface AttachOptions {
  output: HTMLElement;
  input: HTMLInputElement;
  prompt: HTMLElement;
  root: HTMLElement;
  pages?: FileEntry[];
  collections?: Collection[];
  promptLabel?: string;
}

export interface TerminalHandle {
  destroy(): void;
}

const COMMANDS = ['cat', 'cd', 'clear', 'find', 'grep', 'help', 'ls', 'open', 'pwd', 'sl', 'view'];

export function attachTerminal(opts: AttachOptions): TerminalHandle {
  const {
    output: outputEl,
    input: inputEl,
    prompt: promptEl,
    root: termEl,
    pages = [],
    collections = [],
    promptLabel = 'user@site',
  } = opts;

  const fs = buildFs(pages, collections);
  let cwd = '/';
  const cmdHistory: string[] = [];
  let historyIdx = -1;

  function promptText() {
    return `${promptLabel}:${cwd === '/' ? '~' : '~' + cwd}$`;
  }

  function appendLine(text: string, cls?: string) {
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.textContent = text;
    outputEl.appendChild(el);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function appendHtml(html: string, cls?: string) {
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.innerHTML = html;
    outputEl.appendChild(el);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function echoInput(val: string) {
    appendHtml(`<span style="color:#7dff7d">${esc(promptText())}</span> ${esc(val)}`);
  }

  function resolveArg(arg: string) {
    const slash = arg.lastIndexOf('/');
    if (slash === -1) return { dir: cwd, file: arg };
    const dir = resolvePath(cwd, arg.slice(0, slash) || '/');
    return { dir, file: arg.slice(slash + 1) };
  }

  function cmdHelp() {
    const rows: [string, string][] = [
      ['help',              'コマンド一覧を表示'],
      ['ls',                '現在の階層の一覧を表示'],
      ['ls -l',             '種別・公開日付きで表示'],
      ['cd <dir>',          'ディレクトリを移動'],
      ['cd ..',             '親ディレクトリに移動'],
      ['cat/view <name>',   '記事の内容を表示'],
      ['open <name>',       'ページ・記事を新しいタブで開く'],
      ['grep <keyword>',    'タイトル・本文をキーワード検索'],
      ['find -name <glob>', 'パターンで記事を検索（例: *java*）'],
      ['clear',             '画面をクリア'],
    ];
    rows.forEach(([c, d]) => {
      appendHtml(`  <span class="ol-file">${esc(c)}</span> <span class="ol-muted">— ${esc(d)}</span>`);
    });
  }

  function cmdLs(args: string[]) {
    const long = args.some(a => /^-l/.test(a));
    const dirArg = args.find(a => !a.startsWith('-'));
    const dir = dirArg ? resolvePath(cwd, dirArg) : cwd;
    const target = fs[dir];
    if (!target) { appendLine(`ls: ${dirArg}: no such directory`, 'ol-err'); return; }

    if (long) {
      target.dirs.forEach(d => {
        appendHtml(`  <span class="ol-muted">d</span>  <span class="ol-muted">          </span>  <span class="ol-dir">${esc(d)}/</span>`);
      });
      target.files.forEach(f => {
        const date = fmtDate(f.pubDate) ?? '          ';
        appendHtml(`  <span class="ol-muted">f</span>  <span class="ol-muted">${date}</span>  <span class="ol-file">${esc(f.name)}</span> <span class="ol-muted">— ${esc(f.title)}</span>`);
      });
    } else {
      target.dirs.forEach(d => appendLine(`  ${d}/`, 'ol-dir'));
      target.files.forEach(f => {
        appendHtml(`  <span class="ol-file">${esc(f.name)}</span> <span class="ol-muted">— ${esc(f.title)}</span>`);
      });
    }
    if (!target.dirs.length && !target.files.length) appendLine('  (empty)', 'ol-muted');
  }

  function cmdCd(target: string | undefined) {
    const next = resolvePath(cwd, target ?? '~');
    if (!fs[next]) {
      appendLine(`cd: no such directory: ${target}`, 'ol-err');
      return;
    }
    cwd = next;
    promptEl.textContent = promptText();
  }

  function cmdOpen(name: string | undefined) {
    if (!name) { appendLine('open: missing argument', 'ol-err'); return; }
    const { dir, file } = resolveArg(name);
    const target = fs[dir];
    if (!target) { appendLine(`open: ${name}: no such directory`, 'ol-err'); return; }
    const found = target.files.find(f => f.name === file);
    if (found) {
      appendLine(`  → ${found.url}`, 'ol-muted');
      window.open(found.url, '_blank', 'noopener,noreferrer');
    } else {
      appendLine(`open: ${name}: not found`, 'ol-err');
    }
  }

  function cmdCat(name: string | undefined) {
    if (!name) { appendLine('cat: missing argument', 'ol-err'); return; }
    const { dir, file } = resolveArg(name);
    const target = fs[dir];
    if (!target) { appendLine(`cat: ${name}: no such file or directory`, 'ol-err'); return; }
    const found = target.files.find(f => f.name === file);
    if (!found) { appendLine(`cat: ${name}: no such file`, 'ol-err'); return; }
    if (!found.body) {
      appendLine(`  (no content — try 'open ${name}')`, 'ol-muted');
      return;
    }
    appendLine(`  ── ${found.title} ──`, 'ol-muted');
    found.body.split('\n').forEach(line => appendLine(line));
  }

  function cmdGrep(args: string[]) {
    const kw = args.join(' ').toLowerCase();
    if (!kw) { appendLine('grep: missing keyword', 'ol-err'); return; }
    let found = 0;
    Object.entries(fs).forEach(([path, n]) => {
      n.files.forEach(f => {
        const haystack = [f.title, f.name, ...(f.tags ?? []), f.body ?? ''].join('\n').toLowerCase();
        if (haystack.includes(kw)) {
          const p = path === '/' ? f.name : `${path.slice(1)}/${f.name}`;
          appendHtml(`  <span class="ol-file">${esc(p)}</span> <span class="ol-muted">— ${esc(f.title)}</span>`);
          found++;
        }
      });
    });
    if (!found) appendLine(`  (no matches for "${args.join(' ')}")`, 'ol-muted');
  }

  function cmdFind(args: string[]) {
    const ni = args.indexOf('-name');
    if (ni === -1 || !args[ni + 1]) {
      appendLine('find: usage: find -name <pattern>', 'ol-err');
      return;
    }
    const pat = args[ni + 1].replace(/^['"]|['"]$/g, '');
    const reStr = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp(`^${reStr}$`, 'i');
    let found = 0;
    const base = cwd;
    Object.entries(fs).forEach(([path, n]) => {
      if (path !== base && !path.startsWith(base === '/' ? '/' : base + '/')) return;
      n.files.forEach(f => {
        if (re.test(f.name)) {
          const rel = '.' + (path === '/' ? '' : path) + '/' + f.name;
          appendLine(`  ${rel}`, 'ol-file');
          found++;
        }
      });
    });
    if (!found) appendLine(`  (no matches for "${pat}")`, 'ol-muted');
  }

  function cmdSl() {
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

    outputEl.appendChild(wrapper);
    outputEl.scrollTop = outputEl.scrollHeight;
    pre.addEventListener('animationend', () => wrapper.remove(), { once: true });
  }

  function execute(raw: string) {
    const input = raw.trim();
    if (!input) return;
    cmdHistory.unshift(input);
    historyIdx = -1;
    echoInput(input);

    const [cmd, ...args] = input.split(/\s+/);
    switch (cmd) {
      case 'help':  cmdHelp(); break;
      case 'cat':
      case 'view':  cmdCat(args[0]); break;
      case 'ls':    cmdLs(args); break;
      case 'cd':    cmdCd(args[0]); break;
      case 'open':  cmdOpen(args[0]); break;
      case 'grep':  cmdGrep(args); break;
      case 'find':  cmdFind(args); break;
      case 'pwd':   appendLine(cwd === '/' ? '/' : cwd); break;
      case 'sl':    cmdSl(); break;
      case 'clear': outputEl.innerHTML = ''; break;
      default:
        appendLine(`${cmd}: command not found  (type 'help' for commands)`, 'ol-err');
    }
  }

  function tabComplete(val: string): string {
    const parts = val.trimStart().split(/\s+/);
    const cmd = parts[0];
    const arg = parts[1] ?? '';

    if (parts.length === 1) {
      const ms = COMMANDS.filter(c => c.startsWith(cmd));
      if (ms.length === 1) return ms[0] + ' ';
      if (ms.length > 1) { echoInput(val); appendLine('  ' + ms.join('  '), 'ol-muted'); }
      return val;
    }

    if (cmd === 'cd' || cmd === 'ls') {
      const dirArg = parts.slice(1).find(p => !p.startsWith('-')) ?? '';
      const slash = dirArg.lastIndexOf('/');
      const dirPart = slash === -1 ? cwd : resolvePath(cwd, dirArg.slice(0, slash) || '/');
      const prefix  = slash === -1 ? dirArg : dirArg.slice(slash + 1);
      const pathPrefix = slash === -1 ? '' : dirArg.slice(0, slash + 1);
      const targetNode = fs[dirPart];
      if (!targetNode) return val;
      const ms = targetNode.dirs.filter(d => d.startsWith(prefix));
      const flags = parts.slice(1).filter(p => p.startsWith('-')).join(' ');
      const flagStr = flags ? flags + ' ' : '';
      if (ms.length === 1) return `${cmd} ${flagStr}${pathPrefix}${ms[0]}/`;
      if (ms.length > 1) { echoInput(val); appendLine('  ' + ms.join('  '), 'ol-muted'); }
      return val;
    }

    if (cmd === 'cat' || cmd === 'view' || cmd === 'open') {
      const { dir, file: prefix } = resolveArg(arg);
      const targetNode = fs[dir];
      if (!targetNode) return val;
      const pathPrefix = arg.includes('/') ? arg.slice(0, arg.lastIndexOf('/') + 1) : '';
      const fileMs = targetNode.files.map(f => f.name).filter(n => n.startsWith(prefix));
      const dirMs  = targetNode.dirs.filter(d => d.startsWith(prefix));
      if (fileMs.length === 1 && dirMs.length === 0) return `${cmd} ${pathPrefix}${fileMs[0]}`;
      if (dirMs.length === 1  && fileMs.length === 0) return `${cmd} ${pathPrefix}${dirMs[0]}/`;
      const all = [...dirMs.map(d => d + '/'), ...fileMs];
      if (all.length > 1) { echoInput(val); appendLine('  ' + all.join('  '), 'ol-muted'); }
      return val;
    }

    return val;
  }

  appendLine("Welcome to the terminal. Type 'help' for available commands.", 'ol-muted');
  appendLine('', '');
  promptEl.textContent = promptText();

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const val = inputEl.value;
      inputEl.value = '';
      execute(val);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      inputEl.value = tabComplete(inputEl.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx < cmdHistory.length - 1) {
        historyIdx++;
        inputEl.value = cmdHistory[historyIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        historyIdx--;
        inputEl.value = cmdHistory[historyIdx];
      } else {
        historyIdx = -1;
        inputEl.value = '';
      }
    }
  };

  const onClick = () => inputEl.focus();

  inputEl.addEventListener('keydown', onKeydown);
  termEl.addEventListener('click', onClick);

  return {
    destroy() {
      inputEl.removeEventListener('keydown', onKeydown);
      termEl.removeEventListener('click', onClick);
    },
  };
}
