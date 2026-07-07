param(
  [Parameter(Mandatory=$true)][string]$Repo
)

$Root = Split-Path -Parent $PSScriptRoot
$CsvPath = Join-Path $Root "labels.csv"
$labels = Import-Csv $CsvPath

foreach ($label in $labels) {
  $name = $label.name
  $desc = $label.description
  $color = $label.color

  $exists = gh label list --repo $Repo --search $name --json name --jq ".[] | select(.name == `"$name`") | .name"

  if ($exists) {
    gh label edit $name --repo $Repo --description "$desc" --color "$color"
    Write-Host "Updated label: $name"
  } else {
    gh label create $name --repo $Repo --description "$desc" --color "$color"
    Write-Host "Created label: $name"
  }
}
