# PKGBUILD for Arch-based distros (CachyOS, Arch, Manjaro...)
# Build:  makepkg -sf
pkgname=whatsapp-linux
pkgver=1.0.0
pkgrel=1
pkgdesc="Cliente de escritorio de WhatsApp para Linux (no oficial, basado en WhatsApp Web)"
arch=('x86_64')
url="https://github.com/YOUR_USER/whatsapp-linux"
license=('MIT')
depends=('gtk3' 'nss' 'libnotify' 'libxss' 'libxtst' 'xdg-utils')
makedepends=('nodejs' 'npm' 'librsvg' 'imagemagick')
source=("$pkgname-$pkgver.tar.gz::https://github.com/YOUR_USER/whatsapp-linux/archive/refs/tags/v$pkgver.tar.gz")
sha256sums=('SKIP')

build() {
  cd "$pkgname-$pkgver"
  npm ci --no-audit --no-fund
  npx electron-builder --linux dir --config electron-builder.yml
}

package() {
  cd "$pkgname-$pkgver"
  local destdir="$pkgdir/opt/$pkgname"
  install -d "$destdir"
  cp -r "dist/linux-unpacked/." "$destdir/"

  install -Dm644 "dist/linux-unpacked/${productName}.png" "$pkgdir/usr/share/pixmaps/$pkgname.png" 2>/dev/null || true
  install -Dm644 assets/icon-512.png "$pkgdir/usr/share/icons/hicolor/512x512/apps/$pkgname.png"
  install -Dm644 assets/icon-256.png "$pkgdir/usr/share/icons/hicolor/256x256/apps/$pkgname.png"
  install -Dm644 assets/icon-128.png "$pkgdir/usr/share/icons/hicolor/128x128/apps/$pkgname.png"
  install -Dm644 assets/icon-64.png  "$pkgdir/usr/share/icons/hicolor/64x64/apps/$pkgname.png"
  install -Dm644 assets/icon-32.png  "$pkgdir/usr/share/icons/hicolor/32x32/apps/$pkgname.png"

  install -d "$pkgdir/usr/share/applications"
  cat > "$pkgdir/usr/share/applications/$pkgname.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=WhatsApp
GenericName=Mensajería
Comment=Cliente de escritorio de WhatsApp para Linux
Exec=/opt/$pkgname/whatsapp-linux %u
Icon=$pkgname
Terminal=false
StartupWMClass=WhatsApp Linux
Categories=Network;InstantMessaging;
MimeType=x-scheme-handler/whatsapp;
EOF
}
