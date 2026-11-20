# Schreibt models/noten-raum.glb als Base64 in models.js,
# damit das Spiel auch ohne Webserver (Doppelklick auf index.html) die Modelle laden kann.
$root = Split-Path -Parent $PSScriptRoot
$glb = Join-Path $root "models\noten-raum.glb"
$out = Join-Path $root "models.js"
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($glb))
$js = "// Automatisch erzeugt aus models/noten-raum.glb (Blender: tools/build_models.py). Nicht von Hand bearbeiten.`nwindow.NR_MODELS_GLB=`"$b64`";`n"
[IO.File]::WriteAllText($out, $js, (New-Object System.Text.UTF8Encoding($false)))
"models.js geschrieben: {0:N0} Zeichen" -f $js.Length
