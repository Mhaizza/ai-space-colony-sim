param(
  [Parameter(Mandatory=$true)][string]$Repo
)

$Root = Split-Path -Parent $PSScriptRoot
$CsvPath = Join-Path $Root "issues.csv"
$issues = Import-Csv $CsvPath

foreach ($issue in $issues) {
  $title = $issue.title
  $body = $issue.body
  $labels = $issue.labels -replace ";", ","
  $milestone = $issue.milestone

  $existing = gh issue list --repo $Repo --state all --search """$title"" in:title" --json title --jq ".[] | select(.title == `"$title`") | .title"

  if ($existing) {
    Write-Host "Skipped existing issue: $title"
    continue
  }

  if ($milestone -and $labels) {
    gh issue create --repo $Repo --title "$title" --body "$body" --label "$labels" --milestone "$milestone" | Out-Null
  } elseif ($labels) {
    gh issue create --repo $Repo --title "$title" --body "$body" --label "$labels" | Out-Null
  } else {
    gh issue create --repo $Repo --title "$title" --body "$body" | Out-Null
  }

  Write-Host "Created issue: $title"
}
