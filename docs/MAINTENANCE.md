# Cómo mantener el proyecto vivo

Guion corto para no perder el rumbo cuando vuelvas a este repo en 3 meses.

## 1. Automatiza (lo más importante)

| Tarea | Herramienta | Cadencia |
|---|---|---|
| Fijar versión de Electron cada 2 semanas | `npm outdated` + `npx npm-check-updates -u electron` | quincenal |
| Build AppImage/deb/pacman en cada tag `v*` | `.github/workflows/build.yml` | automático |
| Alerta de dependencias vulnerables | `npm audit` + Dependabot (`dependabot.yml`) | semanal |
| Publicar release con notas | Release workflow (ya conectado vía `GH_TOKEN`) | automático |

Añade `.github/dependabot.yml` con `package-ecosystem: npm` y
`schedule: interval: weekly` y te olvidas de revisar parches a mano.

## 2. Riesgos reales y cómo cubrirlos

* **Cambio de UA.** Si WhatsApp Web bloquea electron, actualiza `CHROME_UA`
  en `src/main.js` manteniendo `Chrome/<n>` acorde a la versión de Chromium de
  Electron. Se puede automatizar leyendo `process.versions.chrome`.
* **Cambio de marca/DOM.** Los inyectores CSS/JS (`src/preload.js`) son lo primero
  que se rompe: mantenlo mínimo y coméntalo.
* **Política de WhatsApp.** Publica el Aviso legal en el README (ya está) y
  **nunca** uses el logo de WhatsApp como asset final; migra a un icono genérico.
* **Licencia.** No cambies MIT a GPL: matas la adopción de empaquetadores externos.

## 3. Vías de crecimiento (ordenadas por impacto)

1. **AUR / Flathub:** app-empaquetadores externos te traen usuarios sin esfuerzo.
2. **Multi-cuenta + separación de procesos:** `--user-data-dir` por perfil.
3. **Auto-reactivación al inicio:** `desktop: Extension` systemd user unit.
4. **Soporte de llamadas:** ya funciona vía WebRTC; prueba getUserMedia con
   `--enable-features` de pipewire (`--spawn` para Wayland).
5. **i18n:** cadena `productName` por locale en electron-builder.
6. **Prueba de humo:** GitHub Action que lance la app con `xvfb-run` y verifique que
   la ventana aparece (graba un `grim`/`xwd` a `/tmp`) — te avisa si algo se rompe.

## 4. Publicación

```bash
git remote add origin git@github.com:danielnop/whatsapp-linux.git
git push -u origin main
git tag v1.0.0 && git push --tags   # dispara el build del workflow
```

## 5. Mantenimiento del repositorio del experimento

* Apunta a `docs/WINE.md` en cada issue «no funciona en Wine» — te ahorra el 80 % de
  las repeticiones.
* Añade una **plantilla de issues** cuando alguien pregunte “¿funciona con Wine?”
  para cerrar rápido.
