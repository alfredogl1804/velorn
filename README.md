# Monstruo Studio

**Monstruo Studio** is the multimedia and cinematography specialist of **El Monstruo**. It combines a nonlinear editor, AI-assisted generation workflows, ComfyUI integration, reversible timeline operations, export/QC tooling, and an MCP surface for governed automation.

## Product identity

The visible product is **Monstruo Studio**. Its canonical mark is the cyan `MS` monogram on a black rounded plate. The interface uses black and near-black hierarchy, `#00E5FF` as the primary accent, and Space Grotesk.

## Compatibility contract

Existing work remains compatible by design. Monstruo Studio continues to read and write `project.comfystudio`, accepts historical workflow markers and resize-node titles, preserves the `comfystudio://` media protocol and bridge namespaces, retains local storage keys, and keeps the MCP endpoint, server key, aliases, and tool IDs stable. New outputs use Monstruo Studio naming while legacy outputs remain discoverable.

The original Velorn installation is not replaced by this branch. The derived app uses its own bundle identifier (`mx.hivecom.monstruostudio`) and a separate Electron user-data profile so both products cannot silently write to the same settings database.

## Development

```bash
npm ci
npm run build
npm run electron:build:mac -- --publish never
```

Run the identity and compatibility tests before packaging:

```bash
node --test tests/monstruoStudioIdentity.test.js
npm run test:mcp-h3
npm run test:mcp-my-workflows
```

## MCP

The loopback MCP endpoint remains `http://127.0.0.1:19790/mcp`. Existing client configuration under the key `velorn` remains valid. MCP display metadata identifies the specialist as **Monstruo Studio**; tool IDs and argument schemas are unchanged.

## Open-source provenance

Monstruo Studio is derived from the [Velorn](https://github.com/VelornLabs/velorn) open-source editor. The original project and contributors retain their copyright. This derived work is distributed under **GNU GPL-3.0**; see [`LICENSE`](LICENSE) and [`docs/monstruo-studio/OPEN_SOURCE_NOTICES.md`](docs/monstruo-studio/OPEN_SOURCE_NOTICES.md).
