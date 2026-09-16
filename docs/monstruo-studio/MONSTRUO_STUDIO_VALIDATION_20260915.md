# Validación final — Velorn → Monstruo Studio

**Fecha:** 15 de septiembre de 2026

**Baseline:** `75ec15323d7235b8997e6159f554f31c2a89660a`

**Rama:** `feat/monstruo-studio-identity-20260915`
**Producto:** Monstruo Studio `0.3.32`

## Dictamen

La misión de identidad queda **IMPLEMENTADA Y VALIDADA** como aplicación macOS separada. Monstruo Studio conserva el motor editorial y los contratos compatibles del baseline Velorn, pero presenta nombre, monograma, bundle, ejecutable, helpers, perfil local y superficies visibles propios.

La variante **A2** es el maestro final. Conserva la M canónica de Space Grotesk Bold y compensa ópticamente la S con un stroke controlado, respondiendo a la observación de Alfredo de que la S original se percibía más flaca. El resultado fue revisado en capturas reales a tamaño de aplicación y no parece un badge añadido sobre el icono anterior.

## Verificado en app instalada

| Gate | Resultado | Evidencia |
|---|---|---|
| Nombre de app | PASS | Finder/Dock/menú: `Monstruo Studio` |
| Bundle ID | PASS | `mx.hivecom.monstruostudio` |
| Ejecutable | PASS | `Monstruo Studio` |
| Versión | PASS | `0.3.32` |
| Firma | PASS | `codesign --verify --deep --strict` |
| Gatekeeper público | NO | Build privada no notarizada; `spctl` la rechaza |
| Perfil separado | PASS | `~/Library/Application Support/Monstruo Studio` |
| Velorn original | PASS | Continúa en `/Users/alfredogongora/Applications/Velorn.app` |
| Coexistencia MCP | PASS | Velorn cerrado; un listener Monstruo Studio en `127.0.0.1:19790` |
| MCP visible | PASS | `serverInfo.title = Monstruo Studio` |
| MCP compatible | PASS | `serverInfo.name = velorn`, protocolo `2024-11-05`, 130 tool IDs |
| Proyecto sintético | PASS | Abierto mediante preview y apply; una timeline, dos tracks, cero clips/assets |
| Cold reopen | PASS | Cierre real, nuevo proceso y reapertura desde disco |
| Operación reversible | PASS | Playhead `0 → 1.5 s → 0` |
| Generación | NO EJECUTADA | ComfyUI offline; no job, render ni consumo |

La firma es válida para uso local con la identidad Apple Development disponible. La ausencia de notarización se reporta de forma explícita y mantiene fuera de alcance una release pública para terceros.

## Verificado en build aislada

El bundle se construyó con Electron Builder `26.15.3` y Electron `28.3.3` desde dependencias bloqueadas. El runtime package gate pasó para `darwin/arm64`; RIFE conservó su provenance y smoke empaquetado. El `app.asar` instalado tiene SHA-256:

```text
ff0a73e4baa5a2842eab795cc9926195515ada0a9a13754c96c052f60b9bc65a
```

El DMG privado se generó como:

```text
release/Monstruo Studio-0.3.32-mac-arm64.dmg
```

Su SHA-256 es:

```text
bd4853a9895a191fcac49ce6e2c21265c31cb173bcdd9f48fa8402311dafcc45
```

Se montó read-only y confirmó `Monstruo Studio.app`, bundle ID correcto, nombre visible correcto y firma interna válida. No se publicó release.

## Verificado en código y tests

Pasaron:

- sintaxis de `electron/main.js`, `electron/preload.js` y `electron/productIdentity.cjs`;
- regresión de metadata de distribución, SVG A2 único, derivados PNG/ICNS/ICO y ausencia de glow;
- regresión de marca visible con allowlist explícita y cerrada;
- snapshot exacto de **130 tool IDs MCP**;
- protocolo `2024-11-05`, server ID estable y title nuevo;
- persistencia de `project.comfystudio`, fallback `project.storyflow`, `comfystudio://`, markers y namespaces;
- fixture real de apertura/guardado/reapertura de proyecto compatible;
- configuración temprana de userData propio antes del primer acceso;
- `test:i18n`, `test:discover`, `test:mcp-h3` y `test:mcp-my-workflows`;
- build de producción Vite;
- scanner final `MONSTRUO_STUDIO_VISIBLE_BRAND_AUDIT.json` con **PASS y cero hallazgos visibles pendientes**.

Los avisos de Vite sobre chunks grandes y módulos importados estática/dinámicamente son deuda preexistente de empaquetado, no fallos de esta identidad.

## Identificadores conservados deliberadamente

Se preservaron los nombres que sostienen compatibilidad:

- `project.comfystudio`, `.comfystudio` y `project.storyflow`;
- esquema `comfystudio://`;
- `comfystudio_bridge`;
- tool IDs y aliases `velorn_*` / `comfystudio_*`;
- `serverInfo.name = velorn`;
- puerto loopback MCP `19790`;
- schemas, markers, storage keys, workflows, jobs, receipts y rutas históricas;
- URLs y atribución del upstream Velorn.

La UI ordinaria muestra Monstruo Studio. Velorn aparece como palabra completa sólo en cuatro excepciones de compatibilidad y una atribución GPL/upstream, todas justificadas por test y mapa.

## Aprobado perceptualmente por P16 bajo delegación de Alfredo

Alfredo detectó la asimetría de peso de la S y luego instruyó «hazlo tú». P16 adoptó A2 después de comparar A/A2, medir geometría y revisar el resultado en la app real. La inspección final concluye:

- M y S equilibradas;
- legibilidad en Dock y shell;
- negro y cyan disciplinados;
- apariencia sobria, no gamer;
- continuidad con Monstruo Code sin copiar su layout;
- Welcome, editor, Generate y Settings/About coherentes;
- cero marca heredada visible en esas superficies.

Las capturas canónicas son `welcome-final.png`, `editor-screen.png`, `generate-screen.png` y `settings-about-screen.png` dentro de `docs/monstruo-studio/qa/screenshots/`.

## No verificado en esta misión

No se ejecutó una exportación multimedia real desde la app instalada, una generación ComfyUI/API, una prueba RunPod, un render de P14/P16, notarización Apple ni publicación de release. La ausencia de esas pruebas no invalida el rebranding; evita mezclar identidad con consumo o infraestructura. Las capacidades permanecen cubiertas por el baseline, tests focales y package gate, pero una operación cinematográfica E2E debe conservar su propia evidencia.

Tampoco se migraron automáticamente preferencias o credenciales desde Velorn. Esta decisión es intencional: los perfiles separados previenen dos escritores y una migración futura debe importar sólo preferencias no sensibles, usando Keychain/safeStorage para secretos.

## Rollback

1. Cerrar Monstruo Studio.
2. Retirar la app derivada si fuera necesario.
3. Abrir `/Users/alfredogongora/Applications/Velorn.app`.
4. Velorn conserva su bundle ID, su `app.asar`, su userData y sus proyectos.

No existe transformación destructiva que revertir. El `app.asar` original sigue con SHA-256:

```text
070c8965735a0526d69952cc175c251a0d6796e1764a9be883090c06f6b49c8a
```
