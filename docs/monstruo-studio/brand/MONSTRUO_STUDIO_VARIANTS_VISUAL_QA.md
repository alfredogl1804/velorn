# QA visual preliminar — variantes MS

**Corte:** 15 de septiembre de 2026.

Las tres variantes se renderizaron desde SVG determinista y contornos de Space Grotesk Bold. La geometría de la **M** coincide exactamente con el glifo canónico de Monstruo Code. La **S** proviene del mismo archivo tipográfico, peso 700.

## Verificación visual

- **Variante A — Claridad horizontal:** M y S son inequívocas y conservan el mayor aire óptico. A 16 px la lectura es la más robusta. Su riesgo es parecer más un wordmark compacto que un monograma.
- **Variante B — Compacta editorial:** mantiene ambas letras separadas con menos espacio y mejor presencia como icono. A 16 px conserva lectura. Su riesgo es perder aire frente a A.
- **Variante C — Masa integrada:** M y S se tocan y forman una masa única sin insertar símbolos externos. Ambas letras siguen identificables en 32, 64, 256 y 1024 px; en 16 px la separación es la más exigente.

No se observó clipping, deformación, glow duplicado, placa secundaria, imagen embebida ni arte heredado. Cada maestro contiene una placa, dos paths de glifos, negro `#000000`, cyan `#00E5FF` y esquinas exteriores transparentes.

## Estado del gate

**PENDIENTE DE ALFREDO.** Este QA comprueba viabilidad técnica, no elige ganador. La identidad de la aplicación no debe aplicarse hasta que Alfredo seleccione A, B o C.
