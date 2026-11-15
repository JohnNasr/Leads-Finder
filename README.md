# Business Lead Finder

A desktop app for finding and managing lead prospects for businesses. It runs Google searches through an Apify actor, turns the organic results into a clean list of organizations, and exports them for follow-up.

## Features

- **Actors:** connect to Apify and choose the actor you want to run.
- **Search:** enter a query and run the selected actor. Progress is shown in the header.
- **Results:** review leads with name, website, location and description. Duplicate domains and non-target sites are filtered out automatically.
- **Import:** load a Google Search dataset exported from Apify.
- **Export:** save the current results from the side panel.
- **Settings:** store your Apify API token locally.

## Tech stack

- [Tauri 2](https://tauri.app/) for the desktop shell
- React 18 with TypeScript
- Vite and Tailwind CSS
- Apify MCP server for actor access

## Getting started

### Prerequisites

- Node.js 20 or later
- Rust toolchain (required by Tauri)
- An Apify API token

### Install

```bash
npm install
```

### Run in development

```bash
npm run tauri:dev
```

### Build a desktop release

```bash
npm run tauri:build
```

### Other scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the web UI only |
| `npm run typecheck` | Type-check the project |
| `npm run lint` | Lint the source |
| `npm run build` | Type-check and build the web bundle |

## Usage

1. Open **Settings** and save your Apify token.
2. Go to **Actors** and select an actor.
3. Go to **Search**, enter your query and run it.
4. Review the leads in **Results**.
5. Export the list from the side panel.

## Project structure

```
src/
  components/   UI components (ActorSelector, LeadFinder, ResultsTable, Settings)
  services/     Apify MCP connection, actor lookup, lead normalization and export
  hooks/        Shared React hooks
  types/        Shared TypeScript types
src-tauri/      Tauri (Rust) backend and app configuration
```

## Contributing

- Keep the CI pipeline in `.github/workflows/ci.yml` green.
- Run `npm run typecheck` and `npm run lint` before committing.
