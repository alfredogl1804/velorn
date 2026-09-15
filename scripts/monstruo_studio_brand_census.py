#!/usr/bin/env python3
"""Build a complete source-level brand reference map for Monstruo Studio.

This scanner is intentionally read-only with respect to product code. It records
where Velorn/ComfyStudio identifiers occur and classifies each occurrence for the
future rebrand implementation.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "monstruo-studio"
MAP_PATH = OUT_DIR / "MONSTRUO_STUDIO_BRAND_MAP.json"
AUDIT_PATH = OUT_DIR / "MONSTRUO_STUDIO_VISIBLE_BRAND_AUDIT.json"

TERMS = re.compile(r"VelornLabs|velorn\.ai|Velorn|velorn|ComfyStudio|comfystudio")
TEXT_SUFFIXES = {
    ".cjs", ".css", ".html", ".js", ".jsx", ".json", ".md", ".mjs",
    ".svg", ".txt", ".yaml", ".yml",
}
SKIP_PARTS = {".git", "node_modules", "dist", "release"}
VISIBLE_ROOTS = {"src", "public"}
LEGAL_DOC_PREFIXES = (
    "docs/RELEASE_NOTES_",
    "docs/AI_",
    "docs/CI_SECRETS",
    "docs/RELEASE_PROCESS",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_text_candidate(path: Path) -> bool:
    if any(part in SKIP_PARTS for part in path.parts):
        return False
    if path.name in {"package-lock.json"}:
        return False
    return path.suffix.lower() in TEXT_SUFFIXES or path.name in {"package.json", "README.md", "AGENTS.md"}


def classify(rel: str, line: str, token: str) -> tuple[str, str]:
    lower = line.lower()
    rel_lower = rel.lower()

    compatibility_signals = (
        ".comfystudio", "comfystudio://", "comfystudio-", "comfystudio_",
        "velorn_*", "velorn_", "velorn-", "velorn:", "127.0.0.1:19790",
        "class comfystudio", "createcomfystudio", "listcomfystudio",
        "inspectcomfystudio", "getcomfystudio", "installcomfystudio",
        "velorn bridge", "velorn endpoint", "velorn_input", "velorn_output",
    )
    if any(signal in lower for signal in compatibility_signals):
        return (
            "COMPATIBILITY_KEEP",
            "Identificador técnico o legado que debe mantenerse para proyectos, protocolos, workflows, storage o integraciones existentes.",
        )

    if rel == "package.json":
        if any(key in line for key in ('"productName"', '"appId"', '"name"', '"description"', '"homepage"')):
            return "VISIBLE_RENAME", "Metadata visible o identidad distribuida del producto."
        if any(key in line for key in ('"repository"', '"bugs"', '"author"', '"maintainer"')):
            return "LEGAL_ATTRIBUTION_KEEP", "Atribución y procedencia upstream que no se deben borrar."

    if rel == "index.html" or rel.startswith("public/"):
        return "VISIBLE_RENAME", "Superficie visual, splash, título o asset mostrado al usuario."

    top = rel.split("/", 1)[0]
    if top in VISIBLE_ROOTS:
        return "VISIBLE_RENAME", "Texto o asset dentro de la interfaz visible del renderer."

    if rel == "electron/main.js":
        if any(signal in lower for signal in (
            "title:", "message:", "detail:", "error:", "summary:",
            "description:", "console.", "app.setname", "setaboutpaneloptions",
        )):
            return "VISIBLE_RENAME", "Texto de ventana, diálogo, log o feedback visible de Electron."
        return "REVIEW_INTERNAL", "Referencia del proceso principal que requiere distinguir UX de compatibilidad antes de renombrar."

    if rel == "electron/mcpServer.js":
        if any(signal in lower for signal in (
            "description:", "summary:", "error:", "recommendations.push",
            "name: 'velorn'", 'name: "velorn"', "server name",
        )):
            return "VISIBLE_RENAME", "Metadata o respuesta MCP visible; los tool IDs permanecen sin cambio."
        return "COMPATIBILITY_KEEP", "Nombre interno de clases/callbacks; no es marca visible y cambiarlo aporta riesgo sin valor."

    if rel == "README.md":
        if "velornlabs" in lower or "velorn.ai" in lower:
            return "LEGAL_ATTRIBUTION_KEEP", "Enlace o atribución upstream conservado bajo GPL-3.0."
        return "VISIBLE_RENAME", "Documentación principal presentada a usuarios y contribuidores."

    if rel.startswith(LEGAL_DOC_PREFIXES) or rel == "AGENTS.md":
        return "LEGAL_ATTRIBUTION_KEEP", "Registro histórico, instrucción o atribución upstream que debe conservar contexto."

    if rel.startswith("docs/"):
        return "REVIEW_INTERNAL", "Documentación que debe revisarse por vigencia, visibilidad y valor histórico."

    if token.lower() == "comfystudio":
        return "COMPATIBILITY_KEEP", "Namespace histórico conservado para compatibilidad salvo evidencia de visibilidad."

    return "REVIEW_INTERNAL", "Referencia no visible de forma inequívoca; requiere revisión contextual antes de editar."


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    findings: list[dict[str, object]] = []

    tracked = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    ).stdout.split(b"\0")
    for raw_rel_path in tracked:
        if not raw_rel_path:
            continue
        rel_path = Path(raw_rel_path.decode("utf-8"))
        if not is_text_candidate(rel_path):
            continue
        if rel_path.parts[:2] == ("docs", "monstruo-studio"):
            continue
        if rel_path.name.startswith("monstruo_studio_brand_"):
            continue
        path = ROOT / rel_path
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        for line_number, line in enumerate(lines, start=1):
            for match in TERMS.finditer(line):
                token = match.group(0)
                rel = rel_path.as_posix()
                classification, rationale = classify(rel, line, token)
                findings.append(
                    {
                        "path": rel,
                        "line": line_number,
                        "column": match.start() + 1,
                        "token": token,
                        "classification": classification,
                        "rationale": rationale,
                        "excerpt": line.strip()[:360],
                        "implementation_state": "PENDING_HUMAN_VARIANT_GATE",
                    }
                )

    counts = Counter(item["classification"] for item in findings)
    files_by_class: dict[str, set[str]] = defaultdict(set)
    for item in findings:
        files_by_class[str(item["classification"])].add(str(item["path"]))

    brand_map = {
        "schema": "monstruo-studio.brand-map/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "baseline_commit": "75ec15323d7235b8997e6159f554f31c2a89660a",
        "target_visible_brand": "Monstruo Studio",
        "compatibility_policy": "Preserve project formats, protocols, tool IDs, endpoint IDs, workflows, storage keys, paths and upstream attribution when the old string is an identifier rather than a visible brand.",
        "classifications": {
            "VISIBLE_RENAME": "Must become Monstruo Studio in user-facing product surfaces.",
            "COMPATIBILITY_KEEP": "Must remain available for backward compatibility; may be hidden from normal UX.",
            "LEGAL_ATTRIBUTION_KEEP": "Must remain as truthful upstream history, licensing or repository attribution.",
            "REVIEW_INTERNAL": "Must be reviewed contextually before implementation; do not mass replace.",
        },
        "summary": {
            "findings": len(findings),
            "files": len({str(item["path"]) for item in findings}),
            "by_classification": dict(sorted(counts.items())),
            "files_by_classification": {key: len(value) for key, value in sorted(files_by_class.items())},
        },
        "findings": findings,
    }
    MAP_PATH.write_text(json.dumps(brand_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    visible = [item for item in findings if item["classification"] == "VISIBLE_RENAME"]
    visible_by_file: dict[str, int] = Counter(str(item["path"]) for item in visible)
    audit = {
        "schema": "monstruo-studio.visible-brand-audit/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "phase": "PRE_IMPLEMENTATION",
        "gate": "BLOCKED_PENDING_HUMAN_VARIANT_SELECTION",
        "result": "EXPECTED_FAIL",
        "reason": "The product still intentionally carries Velorn branding because Phase 3 is forbidden until Alfredo selects variant A, B or C.",
        "target_visible_brand": "Monstruo Studio",
        "visible_occurrences_remaining": len(visible),
        "visible_files_remaining": len(visible_by_file),
        "top_visible_files": [
            {"path": path, "occurrences": count}
            for path, count in sorted(visible_by_file.items(), key=lambda item: (-item[1], item[0]))[:100]
        ],
        "compatibility_occurrences_reserved": counts.get("COMPATIBILITY_KEEP", 0),
        "legal_attribution_occurrences_reserved": counts.get("LEGAL_ATTRIBUTION_KEEP", 0),
        "review_internal_occurrences": counts.get("REVIEW_INTERNAL", 0),
        "brand_map_sha256": digest(MAP_PATH),
    }
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"map": str(MAP_PATH), "audit": str(AUDIT_PATH), "summary": brand_map["summary"]}, indent=2))


if __name__ == "__main__":
    main()
