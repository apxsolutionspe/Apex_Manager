# Corrección de caracteres (acentos e iconos) en APEX Swarm Local para Windows.
# Ejecútalo desde la carpeta "src" con el motor detenido.
$ErrorActionPreference = "Stop"
$cwd = (Get-Location).Path
$target = Join-Path $cwd "engine.py"
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    $target = Join-Path $cwd "src\engine.py"
}
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "No se encontró engine.py. Abre PowerShell en APEX_Swarm_Local_v0.3\src."
}
$before = "(ROOT/'index.html').read_text()"
$after = "(ROOT/'index.html').read_text(encoding='utf-8')"
$body = [System.IO.File]::ReadAllText($target, [System.Text.Encoding]::UTF8)
if ($body.Contains($after)) { Write-Host "Corrección ya aplicada." -ForegroundColor Green; exit 0 }
if (-not $body.Contains($before)) { throw "El código de esta versión es diferente. Ningún archivo fue modificado." }
$copy = "$target.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $target -Destination $copy -ErrorAction Stop
$body = $body.Replace($before,$after)
[System.IO.File]::WriteAllText($target,$body,[System.Text.UTF8Encoding]::new($false))
Write-Host "Listo: interfaz UTF-8 reparada. La base SQLite NO fue modificada." -ForegroundColor Green
Write-Host "Respaldo: $copy"
Write-Host "Reinicia desde src: py -3 .\engine.py"
