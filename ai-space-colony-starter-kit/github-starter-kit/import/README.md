# Import Instructions

## Requirements

Install GitHub CLI:

```powershell
winget install --id GitHub.cli
```

Login:

```powershell
gh auth login
```

Choose:

```txt
GitHub.com
HTTPS
Login with web browser
```

## Import

From this folder:

```powershell
cd github-starter-kit/import
```

Run:

```powershell
./import-all.ps1 -Repo "Mhaizza/ai-space-colony-sim"
```

If script execution is blocked:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then run the command again.

## After Import

Open the GitHub Project board and add repository issues to the board.
