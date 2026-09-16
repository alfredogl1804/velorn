# Plan de compatibilidad — Monstruo Studio

**Estado:** implementado y validado el 15 de septiembre de 2026.

## Principio

> La marca visible cambia; los contratos técnicos sólo cambian cuando existe una migración demostrable. Los dos productos no comparten escritores persistentes.

El censo final clasifica cada referencia histórica a Velorn/ComfyStudio. La auditoría permite sólo tres clases residuales: **compatibilidad**, **atribución GPL/upstream** y **referencia interna revisada**. Ninguna aparición heredada queda como identidad pública pendiente.

## Persistencia local separada

Monstruo Studio ejecuta `configureProductIdentity(app, path)` al inicio de `electron/main.js`, **antes del primer `app.getPath('userData')`**. El perfil resultante es:

```text
~/Library/Application Support/Monstruo Studio
```

Velorn conserva:

```text
~/Library/Application Support/velorn
```

La alternativa de reutilizar directamente el perfil `velorn` fue considerada y rechazada: violaría la invariante del onboarding que prohíbe escrituras simultáneas sobre la misma base. La app derivada arrancó con un perfil nuevo que contiene sólo `currentProject`, `defaultProjectsLocation` y `mainWindowState` de la fixture sintética. No se copiaron tokens, cookies, API keys ni credenciales.

La migración futura de preferencias se mantiene **explícita y selectiva**: puede importar preferencias no sensibles después de comparar schemas, mientras las credenciales se reutilizan sólo mediante referencias seguras de Keychain/safeStorage. No existe migración automática silenciosa.

## Proyectos

Se conservan `project.comfystudio`, la extensión `.comfystudio` y el fallback `project.storyflow`. No se migró masivamente ningún proyecto real. La fixture automatizada y la prueba instalada demostraron:

1. lectura de proyecto `.comfystudio`;
2. una timeline de 60 s, 24 fps y dos tracks;
3. apertura preview-only;
4. apertura aplicada por MCP;
5. cierre completo de la app;
6. reapertura en frío del mismo proyecto;
7. preservación de cero clips y cero assets;
8. operación reversible del playhead 0 → 1.5 s → 0.

La prueba usa exclusivamente el proyecto sintético `Monstruo Studio Identity QA`; no abre ni modifica proyectos reales.

## MCP

El endpoint permanece en `http://127.0.0.1:19790/mcp`. Se conservaron exactamente **130 tool IDs**, aliases y argumentos. El handshake devuelve:

```json
{
  "name": "velorn",
  "title": "Monstruo Studio",
  "version": "0.3.32"
}
```

`name: velorn` es un ID de máquina estable; `title: Monstruo Studio` es la identidad visible. Los comandos mostrados en Settings recomiendan el alias humano `monstruo-studio` sin cambiar endpoint ni contrato. El runtime final dejó un solo listener en `127.0.0.1:19790` y Velorn cerrado, cumpliendo la regla de no coexistencia silenciosa.

## Workflows, bridge y storage

Permanecen compatibles:

- `VELORN_*` y `COMFYSTUDIO_*` en workflows;
- `comfystudio_bridge` y sus recursos inyectados;
- `comfystudio://`;
- claves `comfystudio-*` y `velorn-*` de storage/eventos;
- tool IDs y aliases `velorn_*` / `comfystudio_*`;
- schemas de CalibrationPatch, CalibrationProfile, receipts y jobs;
- rutas de artifacts históricos.

Estos identificadores no son marca de producto y no se presentan como tal en la UI ordinaria.

## Servicios y endpoints

No se cambiaron puertos, URLs operativas de ComfyUI/RunPod, providers, stock, captions, exportación, FFmpeg, RIFE, MCP o gateway. No se encendió RunPod, no se abrió túnel y no se ejecutó generación.

## Bundle e instalación

La app derivada usa:

| Campo | Valor |
|---|---|
| Aplicación | `Monstruo Studio.app` |
| Bundle ID | `mx.hivecom.monstruostudio` |
| Ejecutable | `Monstruo Studio` |
| Versión | `0.3.32` |
| Perfil | `~/Library/Application Support/Monstruo Studio` |
| DMG | `Monstruo Studio-0.3.32-mac-arm64.dmg` |

Velorn permanece en `/Users/alfredogongora/Applications/Velorn.app`, con bundle ID `com.comfystudio.app` y `app.asar` SHA-256 `070c8965735a0526d69952cc175c251a0d6796e1764a9be883090c06f6b49c8a`.

## Firma y distribución

La app y el bundle del DMG pasan `codesign --verify --deep --strict` con la identidad Apple Development disponible. Gatekeeper rechaza la build privada porque **no está notarizada**. Esto no bloquea la instalación local ya validada, pero sí impide clasificar el DMG como release pública lista para terceros. Notarización y publicación pública requieren una misión de release separada.

## Rollback

El rollback no transforma datos:

1. cerrar Monstruo Studio;
2. retirar `/Users/alfredogongora/Applications/Monstruo Studio.app` si fuera necesario;
3. abrir `/Users/alfredogongora/Applications/Velorn.app`;
4. Velorn recupera su propio `userData` y proyectos intactos.

No se requiere migración inversa porque los perfiles están separados y los proyectos conservan el formato compatible.
