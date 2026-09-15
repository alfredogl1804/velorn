# Contrato de marca — Monstruo Studio

**Versión:** 1.0-preimplementation
**Estado:** bloqueado hasta la selección perceptual A/B/C

## Identidad pública

| Campo | Valor canónico |
|---|---|
| Nombre de producto | **Monstruo Studio** |
| Descripción corta | **Estudio multimedia y cinematográfico de El Monstruo** |
| Idioma base | Español |
| Bundle ID objetivo | `mx.hivecom.monstruostudio` |
| Nombre de aplicación | `Monstruo Studio.app` |
| Licencia | `GPL-3.0-only` |
| Procedencia | Distribución downstream del proyecto Velorn; atribución upstream preservada |

La aplicación no se presentará al usuario como Velorn ni ComfyStudio. Estos nombres sólo podrán persistir cuando sean necesarios como identificadores de compatibilidad o atribución histórica verdadera.

## ADN visual

| Token | Contrato |
|---|---|
| Lienzo principal | Negro absoluto `#000000` |
| Acento | Cyan canónico `#00E5FF` |
| Tipografía | Space Grotesk |
| Glifo base | `M` oficial de El Monstruo, Space Grotesk Bold 700 convertida a contorno |
| Glifo especialista | `S` de Space Grotesk Bold 700 convertida a contorno |
| Icono | Una sola placa tipo squircle, esquinas transparentes y monograma `MS` |
| Prohibiciones | Sin monstruo literal, cerebro, cámara, claqueta, película, play, timeline, nodos, mosaico, engrane, collage, glow duplicado, placa secundaria o arte heredado |
| Jerarquía | Sobria, editorial y cinematográfica; cyan sólo para acción, foco o estado importante |

La fuente canónica usada es `SpaceGrotesk-Bold.ttf`, SHA-256 `acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72`. La ruta M extraída coincide exactamente con la M del recurso aprobado de Monstruo Code. Space Grotesk está publicada bajo SIL Open Font License 1.1.[1] [2]

## Contrato del monograma

El monograma final debe contener dos glifos identificables: **M** y **S**. Ambos comparten familia, peso, color y altura óptica. No puede insertar símbolos de cine ni depender de una fuente instalada. La variante elegida se convierte en el único SVG maestro del cual se derivan PNG, ICNS e ICO.

El SVG maestro debe cumplir estas invariantes:

1. `viewBox="0 0 1024 1024"`.
2. Una placa negra redondeada; no un lienzo cuadrado opaco exterior.
3. Esquinas exteriores transparentes.
4. Un path para M y un path para S.
5. Cero `<image>`, cero filtros, cero glow y cero sombras internas.
6. Cyan `#00E5FF` para ambos glifos.
7. Lectura comprobable a 16, 32, 64, 256 y 1024 px.

## Capas de nombre

| Capa | Decisión |
|---|---|
| UI, splash, Welcome, Settings, About, Generate, About panel, diálogos, logs visibles | Renombrar a **Monstruo Studio** |
| Metadata MCP mostrada a clientes | Renombrar a **Monstruo Studio** |
| Tool IDs MCP | Mantener sin cambios |
| Endpoint MCP `127.0.0.1:19790/mcp` | Mantener sin cambios |
| Archivo `project.comfystudio` y extensión `.comfystudio` | Mantener sin cambios |
| Protocolo `comfystudio://` | Mantener sin cambios |
| Storage keys `comfystudio-*` y `velorn-*` | Mantener sin cambios |
| Workflow marker IDs `VELORN_*` y `COMFYSTUDIO_*` | Mantener sin cambios |
| Bridge y namespaces `comfystudio_bridge` | Mantener sin cambios |
| Clases/callbacks internos `ComfyStudio*` | Mantener salvo necesidad técnica demostrada |
| Historial, licencia, upstream y atribución | Mantener Velorn/VelornLabs cuando sea verdad histórica o legal |

## Regla de interfaz

Monstruo Studio debe conservar la densidad funcional del editor, pero no la densidad visual. El chrome principal tendrá una jerarquía silenciosa, menos ruido, fondos negros, paneles diferenciados por elevación mínima y divulgación progresiva de opciones avanzadas. Esta fase cambia identidad, no rediseña el editor ni altera arquitectura, flujos, herramientas o comportamiento.

## Gate perceptual

Las variantes A, B y C son candidatos equivalentes en cumplimiento técnico. Alfredo conserva la autoridad perceptual. Ninguna variante se integrará a la aplicación antes de su elección explícita.

## References

[1]: https://github.com/floriankarsten/space-grotesk "Space Grotesk official repository"
[2]: https://fonts.google.com/specimen/Space+Grotesk "Space Grotesk — Google Fonts"
