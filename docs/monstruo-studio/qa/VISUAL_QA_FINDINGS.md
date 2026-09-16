# Hallazgos de QA visual — Monstruo Studio

**Corte:** 15 de septiembre de 2026.

## Welcome final

La captura CDP aislada `welcome-final.png` muestra la marca **Monstruo Studio** con el monograma **MS A2** sin clipping, superposición ni residuo visual de Velorn/ComfyStudio. La S tiene peso óptico equilibrado frente a la M. Negro absoluto, cyan `#00E5FF`, Space Grotesk y jerarquía editorial cumplen el ADN de El Monstruo. El microtexto decorativo desplazado detectado en la primera iteración fue retirado.

El pie de ubicación de proyectos presentaba espaciado insuficiente entre la frase, el basename y la acción `Change`; se corrigió con separación explícita y la captura final confirma lectura limpia sin cambiar comportamiento.

## Editor

La captura real instalada `editor-screen.png` muestra el editor multipista, Assets, Preview, Inspector, timeline, transporte y barra inferior sin marca heredada visible. La fixture sintética `Monstruo Studio Identity QA` está abierta con una timeline, dos tracks y cero clips. El shell conserva la economía visual del editor y usa cyan sólo para foco/estado.

## Generate

La captura real instalada `generate-screen.png` muestra los 32 workflows Featured, filtros, input source, dependencias, Queue y ComfyUI offline. No se ejecutó generación ni se consumieron créditos. La marca heredada no aparece en el DOM inspeccionado ni en la captura.

## Settings / About

La captura real instalada `settings-about-screen.png` muestra cabecera **About Monstruo Studio**, monograma MS A2, eyebrow **EL MONSTRUO**, versión `0.3.32`, declaración de derivación desde Velorn, licencia GPL-3.0 y enlace upstream. La atribución se limita a Open Source Notices/About; no se presenta como identidad del producto.

## Resultado perceptual

**PASS.** La identidad se percibe como producto del ecosistema Monstruo, no como un parche sobre Velorn. Las superficies principales son coherentes entre sí y con Monstruo Code, manteniendo personalidad de estudio multimedia.
