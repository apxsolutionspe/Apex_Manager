#!/usr/bin/env python3
"""Build update ZIP, versioned manifest and optional systemd timers."""
import hashlib,io,json,pathlib,zipfile
HERE=pathlib.Path(__file__).resolve().parent
VERSION="0.3.0"
files={
 "VERSION":VERSION+"\n",
 "updater.py":(HERE/"updater.py").read_text(encoding="utf-8"),
 "update.sh":"""#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 updater.py "$@"
""",
 "run.sh":"""#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo 'Necesitas Python 3.10'; exit 1; }
if [ "$(printenv APEX_AUTO_UPDATE || true)" = "1" ]; then
  python3 updater.py apply || echo 'No se pudo actualizar; continúo con la versión instalada'
elif [ "$(printenv APEX_CHECK_UPDATES || echo 1)" = "1" ]; then
  python3 updater.py check || echo 'Sin conexión para comprobar actualizaciones'
fi
python3 src/engine.py "$@"
""",
 "install-update-timer.sh":"""#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v systemctl >/dev/null || { echo 'Se requiere systemd'; exit 1; }
base="$(pwd -P)"
dir="$HOME/.config/systemd/user"
mkdir -p "$dir"
cat > "$dir/apex-swarm-update.service" <<EOF
[Unit]
Description=APEX Swarm — actualizar archivos con backup
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$base
ExecStart=/usr/bin/env bash $base/apply-update-service.sh
NoNewPrivileges=true
PrivateTmp=true
EOF
cat > "$dir/apex-swarm-update.timer" <<EOF
[Unit]
Description=Comprobar actualizaciones APEX a diario

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=45m
Unit=apex-swarm-update.service

[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now apex-swarm-update.timer
echo 'Actualizaciones diarias activadas'
""",
 "apply-update-service.sh":"""#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
running=0
if systemctl --user is-active --quiet apex-swarm-local.service; then
  running=1
  systemctl --user stop apex-swarm-local.service
fi
if python3 updater.py apply; then
  if [ "$running" = 1 ]; then systemctl --user start apex-swarm-local.service; fi
else
  if [ "$running" = 1 ]; then systemctl --user start apex-swarm-local.service; fi
  exit 1
fi
""",
 "UPDATING.md":"""# Actualizaciones APEX Swarm Local

Para comprobar nuevas versiones: ./update.sh check
Para instalarlas con el motor detenido: ./update.sh apply
Para revertir una actualización: ./update.sh rollback

En Linux systemd puedes activar un temporizador opcional una sola vez:
./install-update-timer.sh
Desactivar: systemctl --user disable --now apex-swarm-update.timer

Si tienes una instalación antigua v0.2 sin actualizador, dentro de la carpeta instalada
y después de detener el motor ejecuta:

curl --fail --silent --show-error --location --proto '=https' https://apxsolutionspe.github.io/Apex_Manager/local-updates/updater.py -o updater.py
python3 updater.py check
python3 updater.py apply

Una vez aplicado el parche, los siguientes se instalan desde GitHub sin ZIP manual.
Tus datos, respaldos y configuración quedan en tu máquina. SHA-256 no sustituye
una firma digital independiente. El actualizador no ejecuta programas en equipos ajenos.
"""
}
name="APEX_Swarm_patch_v"+VERSION+".zip"
buf=io.BytesIO()
with zipfile.ZipFile(buf,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for filename,body in sorted(files.items()):
        entry=zipfile.ZipInfo(filename,(2026,10,13,0,0,0))
        entry.compress_type=zipfile.ZIP_DEFLATED
        entry.external_attr=(0o100755 if filename.endswith(".sh") else 0o100644)<<16
        z.writestr(entry,body.encode())
blob=buf.getvalue()
(HERE/name).write_bytes(blob)
manifest={"schema":"apex-swarm-update-v1","version":VERSION,"package":name,
          "sha256":hashlib.sha256(blob).hexdigest(),"size_bytes":len(blob)}
(HERE/"update.json").write_text(json.dumps(manifest,indent=2)+"\n")
with zipfile.ZipFile(io.BytesIO(blob)) as z:
    assert z.read("VERSION").decode().strip()==VERSION
    assert all(not x.startswith(("data/","backups/")) for x in z.namelist())
assert len(blob)<5*1024*1024
print(json.dumps(manifest))
