# Muestra el id de la ultima AMI creada por Packer (lee manifest.json).
$ruta = Join-Path $PSScriptRoot "manifest.json"
if (-not (Test-Path $ruta)) { Write-Error "No existe manifest.json. Corre primero: packer build ."; exit 1 }
$manifiesto = Get-Content $ruta -Raw | ConvertFrom-Json
$ultima = $manifiesto.builds[-1].artifact_id        # formato "us-east-1:ami-0123456789abcdef0"
$ami = $ultima.Split(":")[1]
Write-Host "AMI: $ami"
Write-Host "Pon esta linea en api/.env:  AMI_ID=$ami"
