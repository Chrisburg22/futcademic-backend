# Notas de Configuration Management — Futcamedic backend

Archivo creado para documentar el ejercicio de CM con git.

## Propósito

Demostrar las 5 acciones básicas de Configuration Management:

1. Create
2. Modify
3. Upload new version
4. Delete
5. Show version history (map)

## Versión

v1.1.0

## Changelog

- v1.0.0 — Creación inicial del archivo con las 5 acciones de CM.
- v1.1.0 — Añadido este changelog y mención de la política de branching (`main` = producción).

## Política de branching

- `main` → rama estable, cada commit puede ser desplegado.
- `feat/*` → nuevas funcionalidades, se mergean a `main` via PR.
- Tags `vX.Y.Z` marcan releases desplegables.
