# Experimento: ejecutar el `.exe` de WhatsApp (Windows) en Linux

> Estado al **08-nov-2026**. Todo lo descrito aquí está reproducible con los scripts/mensajes
> registrados. No se distribuye el binario de WhatsApp: la app descarga el paquete
> **oficial** desde los servidores de Microsoft Store.

## Log

1. **Conseguir el paquete oficial.** El instalador de la web (`WhatsAppSetup.exe`) ya no
 existe: la Store es la única vía. Se consultó el catálogo (`displaycatalog.mp.microsoft.com`)
 y se llamó a `store.rg-adguard.net` con Chromium headless para obtener los enlaces
 `tlu.dl.delivery.mp.microsoft.com` del MSIX de
 `5319275A.WhatsAppDesktop_2.2642.101.0` (298 MB).

2. **Nota:** el binario es un **bundle MSIX** (zip) con `WhatsApp.Root_...x64.msix`
 dentro. Descompresión con `7z x` — sin firmas bloqueantes.

3. **Crear prefix dedicado.**
   ```bash
   export WINEPREFIX=~/.local/share/whatsapp-wine/prefix
   export WINEARCH=win64
   wineboot -i
   ```

4. **Primera ejecución.** `wine WhatsApp.Root.exe` arrancó .NET 8
 (`coreclr.dll` está empaquetado dentro del MSIX) y falló al buscar la clase:
   ```text
   fixme:combase:RoGetActivationFactory (DeploymentInitializeOptions): semi-stub
   err:combase:RoGetActivationFactory Failed to find library for
       L"Microsoft.Windows.ApplicationModel.WindowsAppRuntime.DeploymentInitializeOptions"
   Unhandled exception. System.Runtime.InteropServices.COMException (0x80040154 REGDB_E_CLASSNOTREG)
   ```

5. **Registrar las clases WinRT.** El Windows App Runtime
 (WinAppSDK 2.6.5) declara un catálogo inmenso de clases en su manifiesto. Se generó un
 `.reg` con `DllPath` apuntando a la carpeta descomprimida y se importó con
 `wine regedit /S`. Importante: en los `.reg` las barras invertidas de los valores deben
 escaparse (`\\`) o el registro queda con rutas rotas.

6. **Error 2.** `DeploymentManager.Initialize()` devuelve
 `0x80073D54` = `APPMODEL_ERROR_NO_PACKAGE`. La API quiere identidad de paquete (MSIX),
 que Wine no simula.

7. **Parche de IL.** Se neutralizó el *auto-inicializador* generado por el SDK
 parcheando el cuerpo del método `InitializeWindowsAppSDK` (`ret`). El CLR ahora
 reporta `System.InvalidProgramException` en ese método — el cuerpo reescrito no pasa la
 verificación.

8. **Parche IL definitivo.** El parche que funcionó (`docs/wine-experiment/patch_boot_il.py`)
   no reescribe cuerpos completos (eso daba `InvalidProgramException`): sustituye el
   `call <AccessWindowsAppSDK>` dentro de `InitializeWindowsAppSDK` por **NOPs** y vacía
   `AccessWindowsAppSDK`/`get_Options`. Con esto la app ya no necesita identidad de
   paquete para el bootstrap.

9. **Victoria sobre `NtCreateWaitCompletionPacket`.** El runtime WinRT
   (`CoreMessagingXP.dll`) importa tres funciones de ntdll que **ningún** Wine
   implementa (verificado binariamente en Wine 11.21 del sistema, en
   `wine-11.21-staging-tkg` de Kron4ek y en **GE-Proton 11-12**, y por fuente en
   upstream). Truco que **funcionó**: reescribir los nombres de import en el PE para
   redirigirlos a funciones equivalentes implementadas:

   ```text
   NtCreateWaitCompletionPacket  -> NtCreateEvent    (misma firma, handle válido)
   NtAssociateWaitCompletionPacket -> NtSetEvent
   NtCancelWaitCompletionPacket  -> NtResetEvent
   ```

   Ver `docs/wine-experiment/patch_coremessaging_imports.py`. Tras esto el proceso
   supera la activación de `Microsoft.UI.Xaml.Application`.

10. **Bloqueo final (estructural).** `CoreMessagingXP` intenta conectarse al broker
    del sistema vía ALPC:

    ```text
    fixme:alpc:NtAlpcConnectPort 0xff0a78,
      L"\\BaseNamedObjects\\CoreMessagingRegistrar-32:00000000-...",
      ... stub!
    err:seh:NtRaiseException Unhandled exception code c0000602
    ```

    Wine no implementa puertos ALPC (infraestructura de kernel de Windows) y
    CoreMessaging no tiene modo in-proc: la mensajería de WinRT exige un broker en
    otro proceso. Implementar ALPC en ntdll es un proyecto de meses, no un parche.
    **Aquí termina el experimento**, con el proceso fallando en la excepción
    `c0000602` (fail-fast de CoreMessaging).

## ¿Por qué no hay truco?

* El ejecutable de la Store no se ejecuta “luego”: es un apphost .NET que
  activa clases WinRT del runtime de Windows, no algo que se pueda portar a Wine.
* WinUI 3 depende de `WinRT` + `dcomp` + `DWM`, que Wine no implementa.
* La mensajería WinRT (`CoreMessagingXP`) exige un **broker del sistema** vía
  puertos ALPC de kernel: Wine no implementa ALPC y CoreMessaging no tiene modo in-proc.
* WebView2 (Chromium embebido) no está disponible bajo Wine.
* El formato MSIX exige instalarlo como paquete con identidad, algo inexistente en Wine
  (aunque el parche IL de este directorio lo salta).

## Qué hacer si quieres seguir el experimento

El punto de partida ya no es el paso 7: el parche IL y la redirección de imports
(`docs/wine-experiment/`) están hechos y funcionan. Para avanzar desde el bloqueo
del paso 10 haría falta:

1. Implementar `NtAlpcConnectPort`/`NtAlpcSendWaitReceivePort` (o un broker
   simulado) — requiere tocar ntdll de Wine a nivel de kernel y emular el
   servicio `CoreMessagingRegistrar`.
2. Después vendrían DWM/composición para pintar la ventana WinUI 3 y WebView2,
   que tampoco existen en Wine.
3. Recomendación práctica: **no seguir por aquí**; usa la app no oficial de este
   repo, que consume el mismo endpoint (`web.whatsapp.com`) que la app de Windows.
