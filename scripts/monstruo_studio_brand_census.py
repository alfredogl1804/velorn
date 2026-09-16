#!/usr/bin/env python3
"""Build the final source-level brand reference map for Monstruo Studio.

Every Velorn/ComfyStudio occurrence is retained with an explicit classification.
The visible-brand gate fails closed only for an unapproved user-facing occurrence;
protocol identifiers, project formats and truthful GPL provenance remain intact.
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
LEGAL_DOC_PREFIXES = (
    "docs/RELEASE_NOTES_",
    "docs/AI_",
    "docs/CI_SECRETS",
    "docs/RELEASE_PROCESS",
)

# These exact source fragments are the five deliberately retained whole-word
# legacy names in user-adjacent roots. Four are machine compatibility aliases;
# one is truthful GPL provenance in About.
EXPLICIT_WHOLE_WORD_ALLOWLIST = {
    "electron/comfyLauncher.js": {
        "'User-Agent': 'Velorn-Launcher/1.0'": "COMPATIBILITY_KEEP",
    },
    "electron/comfyui-injected/comfystudio_bridge/web/js/comfystudio_bridge.js": {
        'name: "Velorn.Bridge"': "COMPATIBILITY_KEEP",
    },
    "src/services/comfyui.js": {
        "'Velorn Output Resize'": "COMPATIBILITY_KEEP",
        "'ComfyStudio Output Resize'": "COMPATIBILITY_KEEP",
    },
    "src/components/SettingsModal.jsx": {
        "derived from the Velorn open-source project": "LEGAL_ATTRIBUTION_KEEP",
    },
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_text_candidate(path: Path) -> bool:
    if any(part in SKIP_PARTS for part in path.parts):
        return False
    if path.name == "package-lock.json":
        return False
    return path.suffix.lower() in TEXT_SUFFIXES or path.name in {"package.json", "README.md", "AGENTS.md"}


def allowlisted_whole_word(rel: str, line: str) -> tuple[str, str] | None:
    for fragment, classification in EXPLICIT_WHOLE_WORD_ALLOWLIST.get(rel, {}).items():
        if fragment in line:
            rationale = (
                "Atribución GPL/upstream visible únicamente dentro de Open Source Notices/About."
                if classification == "LEGAL_ATTRIBUTION_KEEP"
                else "Alias legado exacto conservado para interoperabilidad; no representa la identidad pública."
            )
            return classification, rationale
    return None


def classify(rel: str, line: str, token: str) -> tuple[str, str]:
    lower = line.lower()
    token_lower = token.lower()

    explicit = allowlisted_whole_word(rel, line)
    if explicit:
        return explicit

    legal_signals = (
        "velornlabs/velorn",
        "github.com/velornlabs",
        "velorn.ai",
        "derived from the velorn",
        "original velorn",
        "upstream velorn",
        "license-velorn",
    )
    if any(signal in lower for signal in legal_signals):
        return "LEGAL_ATTRIBUTION_KEEP", "URL, licencia o procedencia upstream preservada de forma veraz bajo GPL-3.0."

    compatibility_signals = (
        ".comfystudio", "comfystudio://", "comfystudio-", "comfystudio_",
        "velorn_*", "velorn_", "velorn-", "velorn:", "127.0.0.1:19790",
        "class comfystudio", "createcomfystudio", "listcomfystudio",
        "inspectcomfystudio", "getcomfystudio", "installcomfystudio",
        "velorn bridge", "velorn endpoint", "velorn_input", "velorn_output",
        "velorn.calibration-", "__velorn", "data-theme=\"velorn\"",
        "'velorn'", '"velorn"', "'comfystudio'", '"comfystudio"',
        "isvelornmanaged", "normalizecomfystudio", "velorn.b", "velorn.",
    )
    if any(signal in lower for signal in compatibility_signals):
        return (
            "COMPATIBILITY_KEEP",
            "Identificador técnico o legado conservado para proyectos, protocolos, workflows, storage o integraciones existentes.",
        )

    if rel == "package.json":
        if '"name"' in line:
            return "COMPATIBILITY_KEEP", "Nombre npm interno mantenido para no romper el ecosistema de paquetes."
        if any(key in line for key in ('"repository"', '"bugs"', '"author"', '"maintainer"', '"homepage"')):
            return "LEGAL_ATTRIBUTION_KEEP", "Metadata de procedencia upstream conservada bajo GPL-3.0."
        if any(key in line for key in ('"productName"', '"appId"', '"description"')):
            return "VISIBLE_RENAME", "Metadata distribuida todavía contiene una marca heredada no permitida."

    if rel == "electron/mcpServer.js" and "name: 'velorn'" in lower:
        return "COMPATIBILITY_KEEP", "ID de máquina estable del servidor MCP; el título visible es Monstruo Studio."

    if rel.startswith("public/"):
        if token_lower in {"velorn", "comfystudio"} and any(signal in lower for signal in ('"id"', '"velorn":', '"comfystudio":')):
            return "COMPATIBILITY_KEEP", "Clave/ID de catálogo o traducción conservado; el valor visible usa la marca nueva."
        return "VISIBLE_RENAME", "Superficie pública todavía contiene una marca heredada no clasificada."

    if rel.startswith("src/") and (".test." in rel or rel.endswith(".test.js")):
        return "REVIEW_INTERNAL", "Fixture o aserción de regresión; no se presenta como identidad del producto."

    if rel.startswith("src/"):
        # Lowercase occurrences are namespaces, schemas, IDs, event names, theme
        # keys or provider aliases. Whole-word capitalized names must be either
        # explicitly allowlisted above or are a visible-brand failure.
        if token in {"velorn", "comfystudio"}:
            return "COMPATIBILITY_KEEP", "Namespace, schema, ID o alias interno preservado para compatibilidad."
        if re.search(rf"[A-Za-z0-9_]{re.escape(token)}|{re.escape(token)}[A-Za-z0-9_]", line):
            return "COMPATIBILITY_KEEP", "Nombre de símbolo interno; no es texto presentado como marca."
        return "VISIBLE_RENAME", "Texto heredado de palabra completa dentro de una superficie del renderer."

    if rel == "electron/main.js":
        if token in {"velorn", "comfystudio"}:
            return "COMPATIBILITY_KEEP", "Namespace o ruta interna conservada por compatibilidad."
        if any(signal in lower for signal in ("title:", "message:", "detail:", "error:", "summary:", "description:")):
            return "VISIBLE_RENAME", "Texto de ventana, diálogo o feedback de Electron todavía muestra la marca heredada."
        return "REVIEW_INTERNAL", "Referencia del proceso principal revisada como no visible o históricamente compatible."

    if rel == "README.md":
        return "LEGAL_ATTRIBUTION_KEEP", "Documenta origen, rollback y separación del producto derivado."

    if rel.startswith(LEGAL_DOC_PREFIXES) or rel == "AGENTS.md":
        return "LEGAL_ATTRIBUTION_KEEP", "Registro histórico, instrucción o atribución upstream preservados."

    if rel.startswith("docs/"):
        return "REVIEW_INTERNAL", "Documentación histórica/interna conservada con contexto; no forma parte de la marca en runtime."

    if token_lower in {"velorn", "comfystudio"}:
        return "COMPATIBILITY_KEEP", "Identificador interno conservado para compatibilidad."

    return "REVIEW_INTERNAL", "Referencia no visible revisada contextualmente; no se cambia sin evidencia de seguridad."


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
                state_by_class = {
                    "VISIBLE_RENAME": "REQUIRES_RENAME",
                    "COMPATIBILITY_KEEP": "PRESERVED_COMPATIBILITY",
                    "LEGAL_ATTRIBUTION_KEEP": "PRESERVED_ATTRIBUTION",
                    "REVIEW_INTERNAL": "REVIEWED_INTERNAL",
                }
                findings.append(
                    {
                        "path": rel,
                        "line": line_number,
                        "column": match.start() + 1,
                        "token": token,
                        "classification": classification,
                        "rationale": rationale,
                        "excerpt": line.strip()[:360],
                        "implementation_state": state_by_class[classification],
                    }
                )

    counts = Counter(item["classification"] for item in findings)
    files_by_class: dict[str, set[str]] = defaultdict(set)
    for item in findings:
        files_by_class[str(item["classification"])].add(str(item["path"]))

    brand_map = {
        "schema": "monstruo-studio.brand-map/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "phase": "FINAL_IMPLEMENTATION",
        "baseline_commit": "75ec15323d7235b8997e6159f554f31c2a89660a",
        "target_visible_brand": "Monstruo Studio",
        "compatibility_policy": "Preserve project formats, protocols, tool IDs, endpoint IDs, workflows, storage keys, paths and upstream attribution when the old string is an identifier rather than a visible brand.",
        "classifications": {
            "VISIBLE_RENAME": "Must become Monstruo Studio in user-facing product surfaces.",
            "COMPATIBILITY_KEEP": "Must remain available for backward compatibility; hidden from ordinary UX.",
            "LEGAL_ATTRIBUTION_KEEP": "Must remain as truthful upstream history, licensing or repository attribution.",
            "REVIEW_INTERNAL": "Reviewed internal/history reference; not used as product identity.",
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
    passed = len(visible) == 0
    audit = {
        "schema": "monstruo-studio.visible-brand-audit/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "phase": "FINAL_IMPLEMENTATION",
        "gate": "PASS" if passed else "BLOCKED_VISIBLE_LEGACY_BRAND",
        "result": "PASS" if passed else "FAIL",
        "reason": (
            "No unapproved Velorn or ComfyStudio product branding remains in tracked runtime/user-facing source. Compatibility identifiers and truthful GPL attribution are explicitly classified."
            if passed
            else "One or more unapproved user-facing legacy-brand occurrences remain."
        ),
        "target_visible_brand": "Monstruo Studio",
        "visible_occurrences_remaining": len(visible),
        "visible_files_remaining": len(visible_by_file),
        "visible_findings": visible,
        "compatibility_occurrences_reserved": counts.get("COMPATIBILITY_KEEP", 0),
        "legal_attribution_occurrences_reserved": counts.get("LEGAL_ATTRIBUTION_KEEP", 0),
        "review_internal_occurrences": counts.get("REVIEW_INTERNAL", 0),
        "whole_word_exception_policy": EXPLICIT_WHOLE_WORD_ALLOWLIST,
        "brand_map_sha256": digest(MAP_PATH),
    }
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"map": str(MAP_PATH), "audit": str(AUDIT_PATH), "summary": brand_map["summary"], "gate": audit["gate"]}, indent=2))
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
