#!/usr/bin/env bash
# Installs WhatsApp Linux for the current user (no root needed).
# Usage: ./install.sh <path-to-WhatsApp-Linux.AppImage>
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "uso: $0 <ruta-a-WhatsApp-Linux.AppImage>" >&2
  exit 1
fi

APPIMG="$(readlink -f "$1")"
APPDIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
BIN="$HOME/.local/bin"
DESK="$APPDIR/whatsapp-linux.desktop"

mkdir -p "$BIN" "$APPDIR"
install -m 755 "$APPIMG" "$BIN/WhatsApp-Linux.AppImage"

cat > "$DESK" <<EOF
[Desktop Entry]
Type=Application
Name=WhatsApp
GenericName=Mensajería
Comment=WhatsApp para Linux (cliente no oficial)
Exec=$BIN/WhatsApp-Linux.AppImage %u
Icon=$BIN/WhatsApp-Linux.AppImage
Terminal=false
StartupWMClass=WhatsApp Linux
Categories=Network;InstantMessaging;
MimeType=x-scheme-handler/whatsapp;
EOF

update-desktop-database -q "$APPDIR" 2>/dev/null || true
xdg-mime default whatsapp-linux.desktop x-scheme-handler/whatsapp 2>/dev/null || true

cat > "$HOME/.local/bin/uninstall-whatsapp-linux.sh" <<'EOF'
#!/usr/bin/env bash
rm -f "$HOME/.local/bin/WhatsApp-Linux.AppImage"
rm -f "${XDG_DATA_HOME:-$HOME/.local/share}/applications/whatsapp-linux.desktop"
rm -f "$HOME/.local/bin/uninstall-whatsapp-linux.sh"
echo "✓ Desinstalado."
EOF
chmod +x "$HOME/.local/bin/uninstall-whatsapp-linux.sh"

echo "✓ Instalado: $BIN/WhatsApp-Linux.AppImage"
echo "• Aparece como «WhatsApp» en el menú de aplicaciones."
echo "• Desinstalar: ~/.local/bin/uninstall-whatsapp-linux.sh"
