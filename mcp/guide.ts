/** Text an agent reads before building slides (served by the get_authoring_guide tool). */
export const AUTHORING_GUIDE = `# Presenter: authoring guide for AI agents

Presenter makes step-by-step slides for coding / system-design videos. A deck is a list of slides;
content is revealed one "click" at a time while presenting.

## Slide kinds
- "section": big centred title with an optional small eyebrow above it ("PART ONE"). No elements needed.
- "content": a title at the top plus free-placed elements. THIS is what you build with.
- "flow": an interactive React Flow diagram (nodes + arrows). THIS is the slide kind for flowcharts and architecture.
- "schema": a database ER diagram (tables, columns, foreign keys) whose tables appear one by one. Create it with add_schema_slide from a saved schema.
- "canvas": a freehand Excalidraw drawing. You can create an empty one but only a human can draw on it.

## Stage geometry
Elements live on a 1600 x 900 stage (x, y = top-left corner; w, h = size). Keep content inside
x 100..1500 and y 190..850 (the title occupies the top ~150px). Nothing may overlap unless intended.

## Reveal ("click") model
Every element has an integer "reveal": the click on which it appears. 0 = visible immediately,
1 = after the first click, 2 = after the second ... Elements sharing a number appear together.
Plan it like a talk: what do I say first? Put the first idea at reveal 0 or 1, build up from there.
Cards in cardList and messages in sequence have their own per-item "reveal".

## Elements (all have id, type, x, y, w, h, reveal)
- text:     { text, size (px, ~28-64), style: "serif"|"sans"|"mono"|"hand", accent, align: "left"|"center" }
- box:      { label, icon? (a lucide icon name like "Server", "Database", "Bell"), accent, muted? }   ~250x90
- arrow:    { from: <box id>, to: <box id>, accent, label? }  position fields are ignored (use 0). Needs existing ids.
- cardList: { header, accent, cards: [{ text, reveal }] }   w ~640, each card ~100px tall
- sequence: { actors: [names], messages: [{ from: actorIndex, to: actorIndex, text, kind: "request"|"response", reveal }] }
- strike:   { wrong, right }   renders  ~~wrong~~ is really right
- code:     { code, lang, size, focus: [{ lines: "2-4", reveal }] }   focus dims all other lines from that click on
- mermaid:  { code }  any Mermaid diagram source
- image:    { src }   a URL
- demo:     { demo: "whos-driving" }
accent is one of: amber, blue, green, red, ink, muted.

## Themes
A deck has one theme, used by every slide: "sketch" (warm cream, hand-drawn), "dark" (neutral near-black), "midnight" (deep navy),
"terminal" (green phosphor, all monospace), "violet" (purple dusk) or "ember" (warm charcoal). Content works unchanged in all of them;
set it with create_deck / update_deck.
A deck also has a separate subtle "background" pattern, independent of the theme: plain, grid, dots, lines, graph, glow, gradient, grain (or "theme" for the default). Pick a dark theme for code and system-design talks, sketch for a friendlier explainer.

## Good practice
- One idea per slide. Short labels (1-3 words) in boxes. Titles are sentences or questions ("Who's driving?").
- Prefer add_diagram_slide for flowcharts and architecture: give nodes (shape: box | decision | pill | database | note), edges (with optional labels like "yes"/"no") and a direction. It lays the graph out and reveals it column by column.
- If you already have Mermaid, add_mermaid_flow_slide converts a flowchart to an editable diagram.
- Use shape "decision" (diamond) for yes/no questions and label the two outgoing edges; "pill" for Start/End; "database" for stores.
- Flow edges appear automatically once both of their nodes are visible, so you only choose when nodes appear.
- Prefer add_code_slide for code walkthroughs, add_sequence_slide for request flows, add_comparison_slide for A vs B.
- Reveal progressively: inputs first, then the thing in the middle, then outputs.
- After building, call get_deck to review, and tell the user the editor / present URLs.
- Slide numbers in this API are 1-based (slide 1 = first slide).

## Database schemas (separate from decks)
Schemas are their own documents (the "Database schemas" page in the app). Design one with the schema tools, then optionally present it:
1. create_schema (empty, or with "sql" to import CREATE TABLE statements) — or add_table / add_column.
2. add_relationship links a foreign-key column ("from") to the key it references ("to"); kind N:1 means many rows point at one.
3. layout_schema tidies the diagram (parents left, children right). export_schema gives PostgreSQL / MySQL / SQLite DDL, Mermaid or DBML.
4. add_schema_slide copies it into a deck as a slide whose tables appear one per click.
Use realistic types for the dialect (uuid, timestamptz for PostgreSQL; INT, DATETIME for MySQL). Give every table a primary key.

## Checking your work, notes, drawing
- \`check_slide_layout\` lists off-slide and overlapping elements on content slides; run it after building a slide.
- \`preview_slide\` returns a screenshot (needs the web app running and Chrome/Chromium installed).
- \`set_speaker_notes\` stores private notes per slide (the presenter shows them on S).
- \`draw_on_canvas_slide\` draws rectangles, ellipses, diamonds, text, arrows and lines on a canvas slide (create it with add_slide layout "canvas"); click = reveal step.
`
