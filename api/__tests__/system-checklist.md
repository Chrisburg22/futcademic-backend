# Checklist Pruebas de Sistema (TC-S-01 … TC-S-05)

Ejecución manual. Registrar device, fecha y resultado observado en cada fila.

## TC-S-01 — Gestión completa de alumnos en Android
- **Device**: Pixel 6 / Android 14 / Expo Go
- **Fecha ejecución**: ___________
- **Pasos**:
  - [ ] Navegar a admin/students
  - [ ] Tap "+" → formulario aparece
  - [ ] Llenar nombre, categoría, fecha de nacimiento → guardar
  - [ ] Alumno visible en lista tras creación
  - [ ] Buscar alumno por nombre → aparece en resultados
  - [ ] Tap detalle → pantalla de detalle carga
  - [ ] Cambiar estatus a "Beca" → badge actualizado
  - [ ] Marcar uniforme entregado → switch queda ON
  - [ ] Eliminar → alumno desaparece de lista activa
- **Resultado**: ☐ PASS  ☐ FAIL
- **Notas**: ___________

---

## TC-S-02 — Pase de lista batch en iOS
- **Device**: iPhone 15 Simulator / iOS 18
- **Fecha ejecución**: ___________
- **Pasos**:
  - [ ] Navegar a admin/attendance
  - [ ] Seleccionar categoría "Sub-14" y fecha de hoy
  - [ ] Marcar 6 presentes y 2 ausentes
  - [ ] Tap "Guardar" → toast/mensaje de confirmación visible
  - [ ] Volver a abrir misma categoría/fecha → valores persisten
  - [ ] Sesión aparece marcada como completada
- **Resultado**: ☐ PASS  ☐ FAIL
- **Notas**: ___________

---

## TC-S-03 — Gestión de canchas con datos completos
- **Device**: Web (Chrome)
- **Fecha ejecución**: ___________
- **Pasos**:
  - [ ] Navegar a admin/venues
  - [ ] Tap "Nueva cancha" → formulario
  - [ ] Ingresar nombre "Campo A", dirección, capacidad "50", superficie "cesped natural", iluminación ON
  - [ ] Guardar → cancha visible en lista
  - [ ] Editar capacidad a "100" → guardar cambios → cambio reflejado
  - [ ] Eliminar cancha → desaparece de lista
- **Resultado**: ☐ PASS  ☐ FAIL
- **Notas**: ___________

---

## TC-S-04 — Evento recurrente con cancelación de sesión
- **Device**: Android Pixel 6
- **Fecha ejecución**: ___________
- **Pasos**:
  - [ ] Navegar a admin/events/new
  - [ ] Seleccionar tipo "entrenamiento", categoría "Sub-10", venue "Campo B"
  - [ ] Fecha inicio "2026-04-01", recurrencia "semanal x 4 semanas"
  - [ ] Crear evento → 4 sesiones visibles en agenda
  - [ ] Abrir sesión de la semana 2
  - [ ] Tap "Cancelar esta sesión" → confirmar
  - [ ] Sesión cancelada con badge "Cancelada"
  - [ ] Sesiones 1, 3, 4 intactas
- **Resultado**: ☐ PASS  ☐ FAIL
- **Notas**: ___________

---

## TC-S-05 — Gestión de categorías con asignación de profesor
- **Device**: iOS Simulator
- **Fecha ejecución**: ___________
- **Pasos**:
  - [ ] Navegar a admin/categories
  - [ ] Tap "+" → crear categoría "Sub-16", año "2008", color azul → guardar
  - [ ] Categoría visible con color correcto
  - [ ] Tap categoría → editar → asignar profesor → guardar
  - [ ] Profesor aparece en detalle de la categoría
  - [ ] Ir a teacher-permissions → activar "Gestionar alumnos" y "Tomar asistencia"
  - [ ] Permisos persisten al recargar
- **Resultado**: ☐ PASS  ☐ FAIL
- **Notas**: ___________
