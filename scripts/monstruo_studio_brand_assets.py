#!/usr/bin/env python3
"""Generate deterministic Monstruo Studio MS brand candidates.

The glyph outlines come from Space Grotesk Bold, the same source and weight used
for the canonical Monstruo M. The SVG masters contain outlines only and do not
require the font at runtime.

Validated 2026-09-15 against:
- Google Fonts Space Grotesk, Bold 700
- Florian Karsten Space Grotesk repository, OFL-1.1
"""

from __future__ import annotations

import hashlib
import html
import json
from dataclasses import dataclass
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "monstruo-studio" / "brand"
FONT_CANDIDATES = (
    Path("/Users/alfredogongora/el-monstruo/apps/mobile/assets/fonts/SpaceGrotesk-Bold.ttf"),
    Path(
        "/mnt/6be9a062-1793-4109-80f2-c13ca93045ad/alfredogongora/el-monstruo/"
        "apps/mobile/assets/fonts/SpaceGrotesk-Bold.ttf"
    ),
)
FONT = next((candidate for candidate in FONT_CANDIDATES if candidate.exists()), FONT_CANDIDATES[0])
CANONICAL_M = (
    "M86 0V700H211L423 38H435L647 700H772V0H710V662H698L486 0H372L160 662H148V0Z"
)
CYAN = "#00E5FF"
BLACK = "#000000"
PLATE_STROKE = "#103139"


@dataclass(frozen=True)
class Variant:
    key: str
    name: str
    rationale: str
    m_x: float
    m_y: float
    m_scale: float
    s_x: float
    s_y: float
    s_scale: float
    s_stroke_width: float = 0


VARIANTS = (
    Variant(
        "A",
        "Claridad horizontal",
        "Máxima legibilidad, aire óptico y lectura inmediata de ambas letras.",
        116,
        718,
        0.60,
        560,
        718,
        0.60,
    ),
    Variant(
        "B",
        "Compacta editorial",
        "Kerning cerrado y mayor presencia en Dock sin solapamiento decorativo.",
        86,
        728,
        0.64,
        548,
        724,
        0.64,
    ),
    Variant(
        "C",
        "Masa integrada",
        "M y S se tocan en una sola masa visual; conserva identificación de ambas.",
        74,
        730,
        0.66,
        528,
        730,
        0.66,
    ),
)

OPTICAL_A = Variant(
    "A2",
    "Claridad horizontal · corrección óptica",
    "Conserva la composición A y compensa únicamente el peso percibido de la S.",
    116,
    718,
    0.60,
    560,
    718,
    0.60,
    8,
)


def normalized_text(value: str) -> str:
    return "\n".join(line.rstrip() for line in value.splitlines()) + "\n"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def glyph_path(font: TTFont, character: str) -> tuple[str, tuple[float, float, float, float], float]:
    glyph_set = font.getGlyphSet()
    glyph_name = font.getBestCmap()[ord(character)]
    glyph = glyph_set[glyph_name]
    path_pen = SVGPathPen(glyph_set)
    glyph.draw(path_pen)
    bounds_pen = BoundsPen(glyph_set)
    glyph.draw(bounds_pen)
    assert bounds_pen.bounds is not None
    return path_pen.getCommands(), bounds_pen.bounds, glyph.width


def mark_group(variant: Variant, prefix: str = "") -> str:
    s_stroke = ""
    if variant.s_stroke_width:
        s_stroke = (
            f' stroke="{CYAN}" stroke-width="{variant.s_stroke_width:g}"'
            ' stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill"'
        )
    return f"""
    <g id="{prefix}monogram-{variant.key.lower()}" aria-label="MS">
      <path d="{CANONICAL_M}" fill="{CYAN}"
            transform="translate({variant.m_x:g} {variant.m_y:g}) scale({variant.m_scale:g} {-variant.m_scale:g})"/>
      <path d="{{S_PATH}}" fill="{CYAN}"{s_stroke}
            transform="translate({variant.s_x:g} {variant.s_y:g}) scale({variant.s_scale:g} {-variant.s_scale:g})"/>
    </g>"""


def master_svg(variant: Variant, s_path: str) -> str:
    group = mark_group(variant).replace("{S_PATH}", s_path)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none" role="img" aria-labelledby="title desc">
  <title id="title">Monstruo Studio MS — Variante {variant.key}</title>
  <desc id="desc">{html.escape(variant.rationale)}</desc>
  <rect x="24" y="24" width="976" height="976" rx="232" fill="{BLACK}" stroke="{PLATE_STROKE}" stroke-width="2"/>
{group}
</svg>
"""


def icon_instance(variant: Variant, s_path: str, x: float, y: float, size: float) -> str:
    scale = size / 1024.0
    group = mark_group(variant, prefix=f"preview-{variant.key.lower()}-").replace("{S_PATH}", s_path)
    return f"""
    <g transform="translate({x:g} {y:g}) scale({scale:g})">
      <rect x="24" y="24" width="976" height="976" rx="232" fill="{BLACK}" stroke="{PLATE_STROKE}" stroke-width="2"/>
      {group}
    </g>"""


def comparison_svg(s_path: str) -> str:
    cards: list[str] = []
    for index, variant in enumerate(VARIANTS):
        x = 70 + index * 570
        icon = icon_instance(variant, s_path, x + 132, 160, 256)
        small_sizes = []
        cursor = x + 105
        for size in (16, 32, 64):
            small_sizes.append(icon_instance(variant, s_path, cursor, 475 + (64 - size) / 2, size))
            cursor += max(size + 42, 94)
        shell_icon = icon_instance(variant, s_path, x + 28, 665, 42)
        cards.append(
            f"""
  <g id="card-{variant.key.lower()}">
    <rect x="{x}" y="92" width="520" height="1038" rx="26" fill="#090B0D" stroke="#1B2428"/>
    <text x="{x + 32}" y="139" class="eyebrow">VARIANTE {variant.key}</text>
    {icon}
    <text x="{x + 260}" y="450" class="variant-title" text-anchor="middle">{html.escape(variant.name)}</text>
    {''.join(small_sizes)}
    <text x="{x + 32}" y="574" class="caption">16 · 32 · 64 px · maestro mostrado a 256 px</text>

    <g transform="translate({x + 22} 630)">
      <rect width="476" height="300" rx="18" fill="#000000" stroke="#20272B"/>
      <rect width="476" height="54" rx="18" fill="#07090A"/>
      <rect y="36" width="476" height="18" fill="#07090A"/>
      {shell_icon}
      <text x="80" y="27" class="shell-title">Monstruo Studio</text>
      <circle cx="450" cy="27" r="4" fill="#00E5FF"/>
      <rect x="16" y="72" width="84" height="156" rx="8" fill="#0C0F11"/>
      <rect x="116" y="72" width="224" height="156" rx="8" fill="#07090A"/>
      <rect x="356" y="72" width="104" height="156" rx="8" fill="#0C0F11"/>
      <rect x="16" y="244" width="444" height="40" rx="7" fill="#0A0D0F"/>
      <rect x="126" y="86" width="204" height="112" rx="6" fill="#101417"/>
      <path d="M16 255H460" stroke="#1F2A2F"/>
      <rect x="128" y="210" width="82" height="4" rx="2" fill="#00E5FF"/>
      <rect x="214" y="210" width="112" height="4" rx="2" fill="#353C40"/>
      <text x="28" y="100" class="micro">MEDIA</text>
      <text x="368" y="100" class="micro">INSPECTOR</text>
      <text x="26" y="271" class="micro">TIMELINE</text>
    </g>

    <text x="{x + 32}" y="986" class="label">Lectura</text>
    <text x="{x + 32}" y="1019" class="body">{html.escape(variant.rationale)}</text>
    <text x="{x + 32}" y="1070" class="label">Riesgo a juzgar</text>
    <text x="{x + 32}" y="1103" class="body">{html.escape({'A': 'Puede sentirse más wordmark que monograma.', 'B': 'Puede perder aire en tamaños mínimos.', 'C': 'La unión puede reducir separación M/S.'}[variant.key])}</text>
  </g>"""
        )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1220" viewBox="0 0 1800 1220" role="img" aria-labelledby="title desc">
  <title id="title">Monstruo Studio — comparación perceptual de monogramas MS</title>
  <desc id="desc">Tres variantes vectoriales sobre placa negra, tamaños pequeños y chrome editorial.</desc>
  <defs>
    <style>
      .title {{ font: 700 34px 'Space Grotesk', sans-serif; fill: #F5F5F7; letter-spacing: -0.7px; }}
      .subtitle {{ font: 400 16px 'Space Grotesk', sans-serif; fill: #8E969B; }}
      .eyebrow {{ font: 700 13px 'Space Grotesk', sans-serif; fill: #00E5FF; letter-spacing: 2px; }}
      .variant-title {{ font: 700 23px 'Space Grotesk', sans-serif; fill: #F5F5F7; }}
      .caption {{ font: 500 13px 'Space Grotesk', sans-serif; fill: #7F898E; letter-spacing: .4px; }}
      .shell-title {{ font: 600 15px 'Space Grotesk', sans-serif; fill: #F5F5F7; }}
      .micro {{ font: 600 8px 'Space Grotesk', sans-serif; fill: #667178; letter-spacing: 1px; }}
      .label {{ font: 600 12px 'Space Grotesk', sans-serif; fill: #00E5FF; letter-spacing: 1px; }}
      .body {{ font: 400 12px 'Space Grotesk', sans-serif; fill: #AEB6BA; }}
    </style>
  </defs>
  <rect width="1800" height="1220" fill="#000000"/>
  <text x="70" y="48" class="title">Monstruo Studio · monograma MS</text>
  <text x="70" y="76" class="subtitle">Mismo ADN: Space Grotesk Bold · #00E5FF · negro absoluto · una sola placa · sin glow · sin arte heredado</text>
  {''.join(cards)}
  <text x="70" y="1182" class="subtitle">Gate perceptual: elegir A, B o C antes de aplicar iconos finales o identidad completa a la aplicación.</text>
</svg>
"""


def preview_1024_svg(s_path: str) -> str:
    groups: list[str] = []
    for index, variant in enumerate(VARIANTS):
        x = index * 1072
        groups.append(icon_instance(variant, s_path, x, 0, 1024))
        groups.append(
            f'<text x="{x + 512}" y="1080" text-anchor="middle" '
            f'font-family="sans-serif" font-size="30" fill="#F5F5F7">'
            f'Variante {variant.key} · {html.escape(variant.name)}</text>'
        )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="3168" height="1110" viewBox="0 0 3168 1110">
  <rect width="3168" height="1110" fill="#111417"/>
  {''.join(groups)}
</svg>
"""


def optical_correction_svg(s_path: str) -> str:
    original = icon_instance(VARIANTS[0], s_path, 70, 80, 920)
    corrected = icon_instance(OPTICAL_A, s_path, 1170, 80, 920)
    small_original = "".join(
        icon_instance(VARIANTS[0], s_path, 270 + offset, 1080 + (64 - size) / 2, size)
        for offset, size in zip((0, 100, 220), (16, 32, 64))
    )
    small_corrected = "".join(
        icon_instance(OPTICAL_A, s_path, 1370 + offset, 1080 + (64 - size) / 2, size)
        for offset, size in zip((0, 100, 220), (16, 32, 64))
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="2160" height="1240" viewBox="0 0 2160 1240">
  <rect width="2160" height="1240" fill="#111417"/>
  {original}
  {corrected}
  <text x="530" y="1045" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="34" fill="#F5F5F7">Original A</text>
  <text x="1630" y="1045" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="34" fill="#F5F5F7">A2 · S con corrección óptica</text>
  {small_original}
  {small_corrected}
  <text x="70" y="1194" font-family="Space Grotesk, sans-serif" font-size="24" fill="#8E969B">Único cambio: stroke óptico +8 unidades sobre la S; M, escala, kerning, placa y color permanecen iguales.</text>
</svg>
"""


def main() -> None:
    if not FONT.exists():
        raise SystemExit(f"Missing canonical font: {FONT}")
    font = TTFont(FONT)
    m_path, m_bounds, m_width = glyph_path(font, "M")
    s_path, s_bounds, s_width = glyph_path(font, "S")
    if m_path != CANONICAL_M:
        raise SystemExit("Space Grotesk Bold M does not match the canonical Monstruo M")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    generated: list[Path] = []
    for variant in VARIANTS:
        target = OUTPUT / f"monstruo-studio-ms-{variant.key.lower()}.svg"
        target.write_text(normalized_text(master_svg(variant, s_path)), encoding="utf-8")
        generated.append(target)

    comparison = comparison_svg(s_path)
    comparison_path = OUTPUT / "monstruo-studio-ms-comparison.svg"
    comparison_path.write_text(normalized_text(comparison), encoding="utf-8")
    generated.append(comparison_path)

    preview_1024_path = OUTPUT / "monstruo-studio-ms-1024-preview.svg"
    preview_1024_path.write_text(normalized_text(preview_1024_svg(s_path)), encoding="utf-8")
    generated.append(preview_1024_path)

    optical_master_path = OUTPUT / "monstruo-studio-ms-a2-optical.svg"
    optical_master_path.write_text(normalized_text(master_svg(OPTICAL_A, s_path)), encoding="utf-8")
    generated.append(optical_master_path)

    optical_comparison_path = OUTPUT / "monstruo-studio-ms-a-optical-comparison.svg"
    optical_comparison_path.write_text(
        normalized_text(optical_correction_svg(s_path)),
        encoding="utf-8",
    )
    generated.append(optical_comparison_path)

    for png_name in (
        "monstruo-studio-ms-comparison.png",
        "monstruo-studio-ms-1024-preview.png",
        "monstruo-studio-ms-a-optical-comparison.png",
    ):
        png_path = OUTPUT / png_name
        if png_path.exists():
            generated.append(png_path)

    manifest = {
        "schema": "monstruo-studio.brand-variants/v1",
        "generated_at": "2026-09-15",
        "font": {
            "family": "Space Grotesk",
            "weight": 700,
            "license": "OFL-1.1",
            "source": "https://github.com/floriankarsten/space-grotesk",
            "path_used": str(FONT),
            "sha256": sha256(FONT),
            "units_per_em": font["head"].unitsPerEm,
        },
        "canonical_m_match": True,
        "glyphs": {
            "M": {"bounds": m_bounds, "advance_width": m_width, "svg_path": m_path},
            "S": {"bounds": s_bounds, "advance_width": s_width, "svg_path": s_path},
        },
        "colors": {"background": BLACK, "accent": CYAN, "plate_stroke": PLATE_STROKE},
        "variants": [
            {
                "id": variant.key,
                "name": variant.name,
                "rationale": variant.rationale,
                "svg": f"monstruo-studio-ms-{variant.key.lower()}.svg",
            }
            for variant in VARIANTS
        ]
        + [
            {
                "id": OPTICAL_A.key,
                "name": OPTICAL_A.name,
                "rationale": OPTICAL_A.rationale,
                "svg": "monstruo-studio-ms-a2-optical.svg",
                "optical_correction": {
                    "target": "S",
                    "stroke_width_font_units": OPTICAL_A.s_stroke_width,
                    "estimated_added_weight_percent": 14,
                    "unchanged": ["M", "placement", "scale", "plate", "color"],
                },
            }
        ],
        "files": {path.name: sha256(path) for path in generated},
    }
    manifest_path = OUTPUT / "MONSTRUO_STUDIO_BRAND_VARIANTS_MANIFEST.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
