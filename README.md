# obsidian-directive-blocks

> ⚠️ **Vibe-coded disclaimer:** This plugin was generated entirely by Claude (AI) in a single session with no manual code review. It has not been tested in a real Obsidian vault. Use at your own risk, especially the Pandoc export command which shells out to your system. Contributions and bug reports welcome.

An Obsidian plugin that adds `::: fenced div` directive block syntax to your notes — similar to Pandoc's fenced divs. Write structured content like callouts, ordered lists, and timelines using a clean, readable syntax, with rendering in both Reading View and Live Preview.

---

## Syntax

Directive blocks use triple-colon fences:

```
:::directive-name
body content
:::
```

Optionally pass JSON arguments on the opening line:

```
:::callout {"type":"warning","title":"Heads up"}
Something important to note here.
:::
```

Blocks can be nested:

```
:::outer
Some text.
:::inner
Nested content.
:::
:::
```

---

## Built-in Directives

### `:::ordered`

Renders a bullet list as a numbered `<ol>`.

```
:::ordered
- Write the tests
- Implement the feature
- Ship it
:::
```

### `:::roman`

Same as `:::ordered` but with lower-roman numerals (i, ii, iii…).

```
:::roman
- Introduction
- Methods
- Results
- Discussion
:::
```

### `:::callout`

Renders a styled callout box. Args: `type` (`info` | `warning` | `danger` | `tip`), optional `title`.

```
:::callout {"type":"info","title":"Note"}
This is an informational callout. The body supports **Markdown**.
:::

:::callout {"type":"danger"}
Something will break.
:::
```

### `:::timeline`

Renders a vertical timeline. Each line should be `YYYY-MM-DD: Description`.

```
:::timeline
- 2024-01-15: Project kickoff
- 2024-03-02: First prototype
- 2024-06-30: Public launch
:::
```

---

## Settings

Open **Settings → Directive Blocks** to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Live Preview rendering | On | Render directive blocks as widgets in the editor |
| Reading View rendering | On | Render directive blocks in Reading View |
| CSS class prefix | `directive` | Prefix for wrapper element classes |
| Registered directives | — | Read-only list of all registered directive names |

---

## Pandoc Export

The command **"Export to PDF via Pandoc"** converts the active note to PDF via Pandoc:

1. Reads the raw Markdown source
2. Pre-processes all `:::` directive blocks into plain Markdown equivalents
3. Writes a temp file and runs `pandoc <file> -o <note-name>.pdf`
4. Saves the PDF to your vault root
5. Shows a notice on success or failure

Requires [Pandoc](https://pandoc.org/installing.html) to be installed and on your `PATH`.

You can also use the included [`directives.lua`](directives.lua) filter directly with Pandoc for more accurate output:

```bash
pandoc note.md --lua-filter=directives.lua -o note.pdf
```

The Lua filter maps:

- `:::ordered` → `OrderedList` (decimal)
- `:::roman` → `OrderedList` (LowerRoman)
- `:::callout` → `BlockQuote` with a bold title
- `:::timeline` → `DefinitionList`

---

## Plugin API (for developers)

Other plugins can register custom directives without a hard dependency:

```typescript
function getDirectiveBlocksAPI(app: App) {
  return (app as any).plugins?.plugins?.['directive-blocks']?.api ?? null;
}

const api = getDirectiveBlocksAPI(app);
api?.registerDirective({
  name: 'my-directive',
  render: async ({ source, args, el, app, ctx }) => {
    el.createEl('p', { text: `Custom: ${source}` });
  },
});
```

The `render` function receives:

| Property | Type | Description |
|----------|------|-------------|
| `source` | `string` | Raw body text of the directive block |
| `args` | `Record<string, unknown>` | Parsed JSON args from the opening line |
| `el` | `HTMLElement` | The wrapper element to render into |
| `app` | `App` | The Obsidian App instance |
| `ctx` | `MarkdownPostProcessorContext` | Post-processor context |

---

## Development

```bash
git clone https://github.com/112345brian/obsidian-directive-blocks
cd obsidian-directive-blocks
npm install

# Run tests
npm test

# Build
npm run build

# Watch mode
node scripts/build.ts dev
```

To use in a vault during development, copy `main.js` and `manifest.json` into `.obsidian/plugins/directive-blocks/`.

---

## License

MIT
