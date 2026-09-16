# QA visual preliminar — variantes MS

**Corte:** 15 de septiembre de 2026.

Las tres variantes se renderizaron desde SVG determinista y contornos de Space Grotesk Bold. La geometría de la **M** coincide exactamente con el glifo canónico de Monstruo Code. La **S** proviene del mismo archivo tipográfico, peso 700.

## Verificación visual

- **Variante A — Claridad horizontal:** M y S son inequívocas y conservan el mayor aire óptico. A 16 px la lectura es la más robusta. Su riesgo es parecer más un wordmark compacto que un monograma.
- **Variante B — Compacta editorial:** mantiene ambas letras separadas con menos espacio y mejor presencia como icono. A 16 px conserva lectura. Su riesgo es perder aire frente a A.
- **Variante C — Masa integrada:** M y S se tocan y forman una masa única sin insertar símbolos externos. Ambas letras siguen identificables en 32, 64, 256 y 1024 px; en 16 px la separación es la más exigente.

No se observó clipping, deformación, glow duplicado, placa secundaria, imagen embebida ni arte heredado. Cada maestro contiene una placa, dos paths de glifos, negro `#000000`, cyan `#00E5FF` y esquinas exteriores transparentes.

## Corrección óptica A2

Alfredo detectó correctamente que la S, aunque provenía del mismo peso tipográfico 700, se percibía más delgada que la M porque sus curvas ofrecen menos masa aparente que los trazos rectos. A2 añade únicamente un stroke centrado de 8 unidades de fuente a la S, aproximadamente un 14% de su grosor nominal. La M, escala, altura, posición, kerning, placa y color permanecen idénticos a A.

La comparación grande confirma que la S gana presencia sin volverse tosca. En 16, 32 y 64 px sigue siendo identificable y no invade la M. No hay clipping ni uniones accidentales.

## Estado del gate

**PENDIENTE DE ALFREDO.** La dirección A fue señalada como correcta; la aplicación no debe cambiar hasta que Alfredo confirme la corrección A2.
