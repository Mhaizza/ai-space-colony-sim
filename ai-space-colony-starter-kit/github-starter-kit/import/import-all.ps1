param(
  [Parameter(Mandatory=$true)][string]$Repo
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Importing labels..."
& "$PSScriptRoot/import-labels.ps1" -Repo $Repo

Write-Host "Importing milestones..."
& "$PSScriptRoot/import-milestones.ps1" -Repo $Repo

Write-Host "Importing issues..."
& "$PSScriptRoot/import-issues.ps1" -Repo $Repo

Write-Host "Done."
