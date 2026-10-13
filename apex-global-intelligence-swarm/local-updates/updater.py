#!/usr/bin/env python3
"""APEX Swarm Local updates: version checks, SHA-256, safe patches, backup and rollback."""
from __future__ import annotations
import argparse, hashlib, io, json, os, shutil, socket, stat, sys, tempfile, time
import urllib.parse, urllib.request, urllib.error, zipfile
from pathlib import Path, PurePosixPath

ROOT=Path(__file__).resolve().parent
BASE="https://apxsolutionspe.github.io/Apex_Manager/local-updates/"
MANIFEST=BASE+"update.json"
MAX_ZIP=5*1024*1024
ALLOWED_ROOT={"updater.py","update.sh","run.sh","VERSION","UPDATING.md","install-update-timer.sh","apply-update-service.sh"}
BLOCKED={"data","backups",".git",".env","__pycache__",".ssh"}
class UpdateError(Exception): pass
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise UpdateError("Redirección bloqueada")
def remote_bytes(url, limit):
    u=urllib.parse.urlsplit(url); b=urllib.parse.urlsplit(BASE)
    if (u.scheme,u.netloc)!=(b.scheme,b.netloc) or not u.path.startswith(b.path) or u.username or u.password or u.query or u.fragment:
        raise UpdateError("Servidor o URL no autorizados")
    req=urllib.request.Request(url,headers={"User-Agent":"APEX-Swarm-Updater/0.3"})
    try:
        with urllib.request.build_opener(NoRedirect).open(req,timeout=20) as response:
            data=response.read(limit+1)
    except (urllib.error.URLError,TimeoutError) as e:
        raise UpdateError("No se pudo consultar GitHub Pages: "+str(e)) from e
    if len(data)>limit: raise UpdateError("Descarga supera el límite permitido")
    return data
def semver(v):
    x=str(v).split(".")
    if len(x)!=3 or any(not y.isdigit() or len(y)>5 for y in x): raise UpdateError("Versión inválida")
    return tuple(map(int,x))
def current_version(root=ROOT):
    p=Path(root)/"VERSION"
    return p.read_text(encoding="utf-8").strip() if p.exists() else "0.2.0"
def read_manifest(fetch=remote_bytes):
    try: x=json.loads(fetch(MANIFEST,32768))
    except (ValueError,TypeError) as e: raise UpdateError("Manifiesto incorrecto: "+str(e)) from e
    if not isinstance(x,dict): raise UpdateError("Manifiesto inválido")
    semver(x.get("version",""))
    sha=x.get("sha256")
    name=x.get("package")
    if not isinstance(sha,str) or len(sha)!=64 or any(c not in "0123456789abcdef" for c in sha):
        raise UpdateError("Huella SHA-256 inválida")
    if not isinstance(name,str) or not name.startswith("APEX_Swarm_patch_v") or not name.endswith(".zip") or "/" in name or ".." in name:
        raise UpdateError("Nombre de parche prohibido")
    return x
def validate_member(name):
    p=PurePosixPath(name)
    if not name or name.startswith("/") or "\\" in name or ":" in name or name.endswith("/") or any(x in BLOCKED|{".",".."} for x in p.parts):
        raise UpdateError("Ruta prohibida: "+name)
    if (len(p.parts)==1 and p.name not in ALLOWED_ROOT) or (len(p.parts)>1 and (p.parts[0] not in {"src","tests"} or len(p.parts)>4)):
        raise UpdateError("Ruta no permitida: "+name)
    if p.suffix not in {".py",".html",".js",".css",".sh",".md",".txt"} and p.name!="VERSION":
        raise UpdateError("Tipo no permitido: "+name)
    return Path(*p.parts)
def unpack_patch(blob,target):
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        files=[x for x in z.infolist() if not x.is_dir()]
        if not files or len(files)>60 or sum(x.file_size for x in files)>10*1024*1024:
            raise UpdateError("Paquete inválido por tamaño")
        found=set()
        for entry in files:
            rel=validate_member(entry.filename)
            if rel in found: raise UpdateError("Archivo duplicado")
            found.add(rel)
            mode=entry.external_attr>>16
            if stat.S_ISLNK(mode) or stat.S_IFMT(mode) not in (0,stat.S_IFREG):
                raise UpdateError("No se permiten enlaces simbólicos")
            dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True)
            with z.open(entry) as src, dest.open("wb") as out: shutil.copyfileobj(src,out)
        if Path("VERSION") not in found: raise UpdateError("Paquete sin VERSION")
def engine_running(port=8765):
    try:
        with socket.create_connection(("127.0.0.1",port),timeout=.3): return True
    except OSError: return False
def apply_patch(manifest,*,root=ROOT,fetch=remote_bytes,check_running=True):
    root=Path(root).resolve()
    old=current_version(root)
    version=str(manifest["version"])
    if semver(version)<=semver(old):return {"status":"actualizado","version":old}
    if check_running and engine_running():
        raise UpdateError("Detén el motor (Ctrl+C o systemctl --user stop apex-swarm-local.service) para actualizar")
    blob=fetch(BASE+manifest["package"],MAX_ZIP)
    if hashlib.sha256(blob).hexdigest()!=manifest["sha256"]:
        raise UpdateError("SHA-256 no coincide; actualización cancelada")
    backdir=root/"backups"/"updates";backdir.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".apex-stage-",dir=root) as work:
        stage=Path(work);unpack_patch(blob,stage)
        if semver((stage/"VERSION").read_text().strip())!=semver(version):
            raise UpdateError("La versión del ZIP no coincide con el manifiesto")
        files=[x for x in stage.rglob("*") if x.is_file()]
        for file in files:
            target=root/file.relative_to(stage)
            if target.is_symlink() or any(p.is_symlink() for p in target.parents if p!=root and root in p.parents):
                raise UpdateError("Enlace local no permitido")
        back=backdir/(time.strftime("%Y%m%d-%H%M%S")+"-"+str(os.getpid()))
        back.mkdir(mode=0o700)
        # SQLite's backup API preserves journal consistency; never replace data/.
        db=root/"data"/"swarm.sqlite3"
        if db.is_file():
            import sqlite3
            a=sqlite3.connect(db);b=sqlite3.connect(back/"swarm-before-update.sqlite3")
            try: a.backup(b)
            finally: b.close();a.close()
            (back/"swarm-before-update.sqlite3").chmod(0o600)
        prior=[];added=[]
        try:
            for src in files:
                rel=src.relative_to(stage);dest=root/rel
                if dest.exists():
                    backup=back/"old"/rel;backup.parent.mkdir(parents=True,exist_ok=True)
                    shutil.copy2(dest,backup);prior.append(str(rel))
                else: added.append(str(rel))
                dest.parent.mkdir(parents=True,exist_ok=True)
                temp=dest.with_name(dest.name+".apex-new")
                shutil.copy2(src,temp);os.replace(temp,dest)
                if dest.suffix==".sh":dest.chmod(dest.stat().st_mode|stat.S_IXUSR)
            (back/"rollback.json").write_text(json.dumps({"from":old,"to":version,"old":prior,"new":added},indent=2),encoding="utf-8")
        except Exception:
            for rel in prior:
                source=back/"old"/rel
                if source.exists():shutil.copy2(source,root/rel)
            for rel in added:(root/rel).unlink(missing_ok=True)
            raise
    return {"status":"instalado","version":version,"backup":str(back)}
def rollback(*,root=ROOT,check_running=True):
    root=Path(root).resolve()
    if check_running and engine_running():raise UpdateError("Detén el motor antes de revertir")
    folder=root/"backups"/"updates"
    versions=sorted((p for p in folder.iterdir() if (p/"rollback.json").exists()),reverse=True) if folder.exists() else []
    if not versions:raise UpdateError("No hay respaldo para revertir")
    b=versions[0];rec=json.loads((b/"rollback.json").read_text(encoding="utf-8"))
    for rel in rec["old"]:
        shutil.copy2(b/"old"/validate_member(rel),root/validate_member(rel))
    for rel in rec["new"]:(root/validate_member(rel)).unlink(missing_ok=True)
    (b/"rollback.json").rename(b/"rollback-completed.json")
    return {"status":"revertido","version":rec["from"]}
def main(argv=None):
    p=argparse.ArgumentParser(description="Actualizador de APEX Swarm Local")
    p.add_argument("action",nargs="?",default="check",choices=["check","apply","rollback","version"])
    action=p.parse_args(argv).action
    try:
        if action=="version":result={"installed":current_version()}
        elif action=="rollback":result=rollback()
        else:
            manifest=read_manifest()
            result=({"installed":current_version(),"available":manifest["version"],"update_available":semver(manifest["version"])>semver(current_version())}
                    if action=="check" else apply_patch(manifest))
        print(json.dumps(result,ensure_ascii=False));return 0
    except (UpdateError,ValueError,OSError,zipfile.BadZipFile) as e:
        print("APEX UPDATE ERROR: "+str(e),file=sys.stderr);return 1
if __name__=="__main__":raise SystemExit(main())
