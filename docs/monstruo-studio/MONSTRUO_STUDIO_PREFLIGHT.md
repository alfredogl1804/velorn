# Preflight — Velorn → Monstruo Studio

**Corte:** 15 de septiembre de 2026, 22:51 UTC
**Estado:** **VIABLE, BLOQUEADO SÓLO POR EL GATE PERCEPTUAL A/B/C**

## Dictamen

El cambio de identidad es viable sin alterar la funcionalidad multimedia. El bundle instalado coincide con el baseline solicitado, el fork contiene ese commit y el nuevo `CFBundleIdentifier` está libre. No se ha modificado la aplicación instalada, no se ha cerrado el Velorn activo y no se ha tocado ningún proyecto. La implementación funcional permanece prohibida hasta que Alfredo elija una variante MS.

## Baseline verificado

| Elemento | Evidencia |
|---|---|
| App instalada | `/Users/alfredogongora/Applications/Velorn.app` |
| Versión | `0.3.32` |
| Bundle ID actual | `com.comfystudio.app` |
| Firma actual | Válida; Team ID `8J7YH5CKMB` |
| `app.asar` SHA-256 | `070c8965735a0526d69952cc175c251a0d6796e1764a9be883090c06f6b49c8a` |
| `icon.icns` SHA-256 | `db04443ba08f9821cd868dfaad691db66c113125cd0a0b1fc87832d2ff1503f2` |
| `Info.plist` SHA-256 | `779018e3eee18adc41e655e9ae6ff529a780482a31094201d39e2bf6be400ab9` |
| Ejecutable SHA-256 | `7f0cbe5e09033447ef7dfbc1255f99fe04557be647deb9663f8b77ab9b520090` |
| Commit fuente | `75ec15323d7235b8997e6159f554f31c2a89660a` |
| Árbol Git | `addb154cfb290b3b4fcd84006b8ce30f44858de2` |
| Worktree | `/Users/alfredogongora/worktrees/monstruo-studio-identity-20260915` |
| Rama | `feat/monstruo-studio-identity-20260915` |
| Fork | `alfredogl1804/velorn` |
| Bundle ID objetivo | `mx.hivecom.monstruostudio` — sin colisión detectada |
| App objetivo | `/Users/alfredogongora/Applications/Monstruo Studio.app` — no existe todavía |
| Estado de Velorn | Abierto; no se cerrará hasta comenzar pruebas posteriores al gate |

## Persistencia que debe sobrevivir

El directorio actual `/Users/alfredogongora/Library/Application Support/velorn` existe, ocupa aproximadamente **107 MB** y contiene **1,358 archivos**. `settings.json` tiene SHA-256 `780c9ee1123dffc325fb3778bc4ad43ba01e80634c19635e93d80565fb34789c`. Además, se localizaron **215** proyectos `*.comfystudio` bajo `VelornProjects` y **37** bajo `VelornRelocated`.

La aplicación no fija hoy `app.setPath('userData', ...)`; usa `app.getPath('userData')` desde el arranque. Cambiar `productName` podría cambiar la ruta automática y aparentar pérdida de preferencias. Por ello, la implementación deberá fijar explícitamente el `userData` legado antes de su primer uso. Esta solución preserva settings, catálogo de workflows, credenciales almacenadas, estados de launcher y preferencias sin copiar ni reescribir datos.

## Riesgos y control

| Riesgo | Severidad | Control previsto |
|---|---:|---|
| Renombrar identificadores técnicos por búsqueda y reemplazo | Crítico | Aplicar el mapa de marca línea por línea; no mass replace. |
| Perder settings por cambio de nombre Electron | Alto | Fijar explícitamente `userData` al directorio legado antes del primer `getPath`. |
| Romper proyectos `project.comfystudio` | Crítico | Mantener extensión, nombre de archivo y esquema. Añadir una fixture de regresión. |
| Romper MCP o clientes existentes | Crítico | Mantener puerto, URL, tool IDs y aliases; cambiar sólo metadata visible. |
| Romper workflows y nodos | Crítico | Mantener `VELORN_*`, `COMFYSTUDIO_*`, bridge y namespaces internos. |
| Confundir fork con obra original | Alto | Conservar `LICENSE`, historial Git y atribución upstream visible. |
| Sustituir la app buena antes del QA | Alto | Construir y probar aparte; reemplazo sólo después de verificación y backup. |
| Icono con doble placa o parche | Alto | Un solo SVG maestro, una placa, esquinas transparentes, dos glifos y cero glow. |

## Estrategia de rollback

Antes de cualquier instalación posterior al gate se conservará una copia íntegra del bundle funcional con su hash `app.asar`. El reemplazo será atómico: primero se construye y verifica `Monstruo Studio.app` en ruta separada; después se cierra Velorn; luego se valida la nueva app. Si falla un gate crítico, se restaura el bundle anterior sin tocar `/Users/alfredogongora/Library/Application Support/velorn` ni los proyectos.

No se borrará `Velorn.app` durante la fase de build. La retirada de la aplicación anterior será el último paso y sólo ocurrirá cuando la nueva identidad haya pasado pruebas, reapertura en frío, MCP, proyecto, exportación, firma y QA visual.

## Compliance y procedencia

El checkout conserva `LICENSE` con **GNU GPL v3**, SHA-256 `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`; `package.json` declara `GPL-3.0-only`. Monstruo Studio será una distribución downstream GPL-3.0-only. Se conservarán historial Git, licencia, atribución a Velorn contributors y enlace al upstream. No se eliminará procedencia para simular autoría original.[1]

Space Grotesk permanece bajo SIL Open Font License 1.1 y sus glifos se convierten a contornos SVG para evitar dependencia tipográfica en runtime.[2] [3]

## Cambio del entorno durante el preflight

La Mac tenía sólo 116 MB libres. Para poder crear el worktree se eliminó exclusivamente `~/Library/Developer/Xcode/DerivedData`, un caché reconstruible. No se eliminaron repositorios, aplicaciones, proyectos, medios, volúmenes ni datos de Velorn.

## Gate vigente

**No se ha cambiado código funcional, `package.json`, iconos de build, strings de UI, MCP ni bundle.** La siguiente acción autorizable es escoger **A, B o C**. Después de esa elección comienza la implementación completa.

## References

[1]: https://www.gnu.org/licenses/gpl-3.0.html "GNU General Public License v3.0"
[2]: https://github.com/floriankarsten/space-grotesk "Space Grotesk official repository"
[3]: https://fonts.google.com/specimen/Space+Grotesk "Space Grotesk — Google Fonts"
