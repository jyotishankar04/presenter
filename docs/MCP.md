# Presenter MCP server

Lets AI agents (Claude Code, Claude Desktop, Cursor, …) create and edit your decks. Everything an agent
does goes through the same validation as the editor's **Code** tab, so it can never save a slide the
editor can't open. Changes show up live in an open editor.

## Connect

**HTTP** (the app must be running: `npm run dev`):

    claude mcp add --transport http presenter http://localhost:5174/mcp

**stdio** (no server needed; reads/writes `decks/` directly):

    claude mcp add presenter -- npx --prefix /home/devsuvam/Work/presenter tsx /home/devsuvam/Work/presenter/mcp/stdio.ts

Inside this project Claude Code picks up `.mcp.json` automatically (approve it when asked).
For any other client, use command `npx`, args `["tsx", "/home/devsuvam/Work/presenter/mcp/stdio.ts"]`
and set `PRESENTER_DECKS=/home/devsuvam/Work/presenter/decks`.

Environment: `PRESENTER_DECKS` (deck folder, default `./decks`), `PRESENTER_WEB_URL` (used in returned links, default `http://localhost:5173`).

## Tools

| Tool | What it does |
| --- | --- |
| `get_authoring_guide` | Slide kinds, the 1600×900 stage, the reveal/click model, every element. **Read first.** |
| `list_decks`, `get_deck`, `get_slide` | Read decks (outline) and slides (full JSON) |
| `create_deck`, `update_deck`, `delete_deck` | Manage decks (`delete_deck` needs `confirm: true`) |
| `add_slide`, `update_slide`, `delete_slide`, `move_slide`, `duplicate_slide` | Manage slides (1-based numbers or ids) |
| `add_element`, `update_element`, `delete_element`, `set_reveal` | Fine-grained edits on content/section slides |
| `add_diagram_slide` | Flowchart / architecture as an editable **React Flow** diagram: shapes (step, decision, start/end, database, note), labelled and dashed arrows, left-to-right or top-down auto layout, reveal by column / node / all |
| `add_mermaid_flow_slide` | Same, from Mermaid flowchart source (`flowchart LR`, `{decision}`, `-->|label|`, …) |
| `update_flow_slide` | Rebuild or retitle an existing flow slide's graph |
| `add_code_slide` | Code with line spotlights per click |
| `add_sequence_slide` | Sequence diagram, one message per click |
| `add_comparison_slide` | Two columns of cards (A vs B) |

### Database schema tools

| Tool | What it does |
| --- | --- |
| `list_schemas`, `get_schema` | Saved schemas and a readable outline (tables, columns, keys, relationships) |
| `create_schema` | New schema, empty or from SQL (`CREATE TABLE` / `ALTER TABLE … FOREIGN KEY`; PostgreSQL, MySQL, SQLite) |
| `import_sql` | Add (or replace with) tables parsed from SQL |
| `add_table`, `update_table`, `delete_table` | Tables, with columns, comments and colours |
| `add_column`, `update_column`, `delete_column` | Columns: type, PK, NOT NULL, UNIQUE, auto-increment, default, comment |
| `add_relationship`, `delete_relationship` | Foreign keys with kind (N:1, 1:1, 1:N) and ON DELETE / ON UPDATE |
| `layout_schema` | Auto-arrange tables (parents left, children right) |
| `export_schema` | PostgreSQL / MySQL / SQLite DDL, Mermaid `erDiagram`, DBML, or JSON |
| `add_schema_slide` | Copy a schema into a deck as a slide; tables appear one per click |
| `update_schema`, `delete_schema` | Rename / change dialect; delete (needs `confirm: true`) |

Schemas are stored in `schemas/` (override with `PRESENTER_SCHEMAS`). Open pages update live when an agent edits a schema, and a conflict banner appears instead of overwriting if you edited at the same moment.

Resource: `presenter://guide` (same text as the guide tool).

## Notes

- Flow slides are edited as a whole graph (`update_flow_slide`); the per-element tools (`add_element` etc.) apply to content/section slides.
- Canvas (freehand) slides can be created empty and moved/deleted by agents, but only humans can draw on them.
- The server only listens on `127.0.0.1`, and `/mcp` rejects requests whose `Host`/`Origin` isn't local.
- Saves from the editor are conditional: if an agent changed the deck first, the editor pauses and asks you
  whether to load the latest version or keep yours — nothing is silently overwritten.
