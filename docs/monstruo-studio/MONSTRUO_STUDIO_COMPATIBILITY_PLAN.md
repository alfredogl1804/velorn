# Plan de compatibilidad — Monstruo Studio

**Objetivo:** cambiar la identidad pública sin romper proyectos, settings, workflows, MCP, servicios o integraciones.

## Principio

> La marca visible cambia; el contrato técnico sólo cambia cuando existe una razón funcional y una migración demostrable.

El repositorio contiene **2,455** referencias de marca o namespace en **274** archivos rastreados. El censo inicial clasificó 586 ocurrencias como visibles, 1,051 como compatibilidad que debe preservarse, 225 como atribución o historia legal y 593 para revisión contextual. Por ello se prohíbe un reemplazo global.

## Persistencia local

Electron usa `app.getPath('userData')` antes de configurar una ruta propia. Para evitar que `productName = Monstruo Studio` cree un perfil vacío, la implementación fijará explícitamente el directorio heredado:

```text
~/Library/Application Support/velorn
```

Esto debe ocurrir antes de la definición actual de `settingsPath`. El directorio se reutiliza en sitio, sin copiar ni reescribir sus 1,358 archivos. Monstruo Studio será el único proceso que lo use después de retirar Velorn, por lo que no habrá dos escritores simultáneos.

La regresión deberá comprobar que un fixture con settings y catálogo legado se abre con la nueva marca y conserva sus valores.

## Proyectos

Los archivos `project.comfystudio` y la extensión `.comfystudio` permanecen canónicos para lectura y escritura. No se migra masivamente ninguno de los **252** proyectos encontrados. Se añadirá una fixture mínima que demuestre:

1. apertura de un proyecto legado;
2. carga de timeline y assets;
3. guardado sin pérdida;
4. reapertura en frío;
5. exportación válida.

La UI puede mostrar “Proyecto de Monstruo Studio”, pero el archivo físico conserva el namespace legado.

## MCP

El endpoint sigue en `http://127.0.0.1:19790/mcp`. Se mantienen los 130 tool IDs observados, sus aliases y la estructura de argumentos. Sólo cambian el nombre y descripciones visibles del servidor. Una prueba comparará el conjunto de tool IDs antes y después y fallará ante cualquier delta no autorizado.

Los clientes existentes que registraron el servidor con el alias local `velorn` seguirán funcionando. La documentación nueva podrá recomendar el alias `monstruo-studio`, pero no se exige migración inmediata.

## Workflows, bridge y storage

Se conservan sin cambio:

- `VELORN_*` y `COMFYSTUDIO_*` en workflows;
- `comfystudio_bridge` y sus recursos inyectados;
- `comfystudio://`;
- localStorage keys `comfystudio-*` y `velorn-*`;
- eventos IPC y DOM con esos prefijos;
- carpetas temporales y caches que dependen del namespace;
- IDs de Capability, CalibrationProfile, WorkflowCatalog y receipts.

Estos términos no deben aparecer como branding ordinario, pero siguen siendo parte de contratos existentes.

## Servicios y endpoints

No se cambian puertos, URLs de ComfyUI, RunPod, providers, stock, captions, exportación, FFmpeg, RIFE, MCP o gateway. El cambio de `CFBundleIdentifier` se limita al paquete macOS y no autoriza rotar credenciales, cambiar Keychain access groups ni editar servicios externos.

Durante QA se verificará específicamente que el setting `comfyConnection` sigue apuntando al endpoint persistido. No se arrancará GPU ni se generará contenido.

## Bundle e instalación

El paquete objetivo usa `mx.hivecom.monstruostudio`, identificador libre en la Mac. Se construirá `Monstruo Studio.app` en una ruta separada. La app anterior se conserva hasta superar todos los gates. El orden de instalación será:

1. cerrar Velorn de forma limpia;
2. construir y verificar fuera de Applications;
3. abrir la build separada con el `userData` legado;
4. ejecutar smoke, proyecto, MCP y exportación;
5. cerrar y reabrir en frío;
6. verificar firma;
7. respaldar el bundle antiguo;
8. instalar Monstruo Studio;
9. retirar Velorn sólo tras la verificación final.

## Rollback

Un fallo crítico restaura el bundle viejo y conserva intactos `userData` y proyectos. La operación no depende de convertir proyectos ni de migrar settings, por lo que el rollback no requiere transformación inversa.

## Auditoría posterior

El scanner generará un resultado final `PASS` sólo cuando no queden referencias Velorn/ComfyStudio en superficies visibles no permitidas. Las excepciones deberán estar clasificadas como `COMPATIBILITY_KEEP` o `LEGAL_ATTRIBUTION_KEEP` en `MONSTRUO_STUDIO_BRAND_MAP.json`; no se aceptan allowlists sin explicación.
