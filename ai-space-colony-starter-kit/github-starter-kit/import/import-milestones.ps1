param(
  [Parameter(Mandatory=$true)][string]$Repo
)

$Root = Split-Path -Parent $PSScriptRoot
$CsvPath = Join-Path $Root "milestones.csv"
$milestones = Import-Csv $CsvPath

foreach ($m in $milestones) {
  $title = $m.title
  $desc = $m.description

  $existingNumber = gh api "repos/$Repo/milestones?state=all&per_page=100" --jq ".[] | select(.title == `"$title`") | .number"

  if ($existingNumber) {
    gh api --method PATCH "repos/$Repo/milestones/$existingNumber" -f title="$title" -f description="$desc" | Out-Null
    Write-Host "Updated milestone: $title"
  } else {
    gh api --method POST "repos/$Repo/milestones" -f title="$title" -f description="$desc" | Out-Null
    Write-Host "Created milestone: $title"
  }
}
