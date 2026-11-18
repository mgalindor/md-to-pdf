---
title: "md-to-pdf Demo Document"
author: "Documentation Team"
date: "2026-11-17"
tags: "demo, markdown, pdf"
version: "1.0"
---

# Demo Document

This file exercises the full pipeline of **md-to-pdf** end to end: frontmatter,
GitHub-style callouts, and diagrams rendered via Mermaid and Kroki (PlantUML and DBML).

Generate the PDF with:

```powershell
node build-pdf.mjs --frontmatter example\demo.md
```

## Callouts (GitHub-style alerts)

> [!NOTE]
> This is an informational note. Use it to clarify or add extra context without being critical.

> [!TIP]
> This is a helpful tip, for example: use `--h1-new-page` if you want every top-level section to
> start on a new page.

> [!IMPORTANT]
> This information is relevant for correct use of the tool and shouldn't be overlooked.

> [!WARNING]
> Be careful: if your corporate network blocks `kroki.io` or `unpkg.com`, the diagrams on this
> page won't render.

> [!CAUTION]
> This action can have negative consequences if the steps aren't followed correctly.

<!-- page-break -->

## Sequence diagram (Mermaid)

```mermaid
sequenceDiagram
    participant U as User
    participant CLI as build-pdf.mjs
    participant B as Chromium (Puppeteer)
    U->>CLI: node build-pdf.mjs demo.md
    CLI->>CLI: Parse Markdown + frontmatter
    CLI->>B: Render HTML
    B-->>CLI: Generated PDF
    CLI-->>U: demo.pdf
```

## Component diagram (PlantUML)

```plantuml
@startuml
skinparam componentStyle rectangle

package "md-to-pdf" {
  [build-pdf.mjs] --> [markdown-it]
  [build-pdf.mjs] --> [highlight.js]
  [build-pdf.mjs] --> [puppeteer-core]
  [build-pdf.mjs] --> [Kroki API]
}

[puppeteer-core] --> [Chromium / Edge]
[Kroki API] --> [SVG diagram]
@enduml
```

## Database schema (DBML)

```dbml
Table users {
  id int [pk, increment]
  name varchar
  email varchar [unique]
  created_at timestamp
}

Table documents {
  id int [pk, increment]
  user_id int [ref: > users.id]
  title varchar
  format varchar [note: 'pdf, html, etc.']
  generated_at timestamp
}

Table tags {
  id int [pk, increment]
  name varchar [unique]
}

Table document_tags {
  document_id int [ref: > documents.id]
  tag_id int [ref: > tags.id]
}
```

## Wrap-up

This covers the four main elements of the pipeline: **frontmatter**, **callouts**,
**Mermaid diagrams**, and **diagrams via Kroki** (PlantUML and DBML in this example).
