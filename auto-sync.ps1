param(
  [string]$Branch = "auto-sync",
  [int]$IntervalSeconds = 10,
  [switch]$RunChecks,
  [switch]$AllowMain
)

$ErrorActionPreference = "Stop"

function Run-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $result = & git @Args 2>&1
  $ErrorActionPreference = $previousPreference
  $exitCode = $LASTEXITCODE
  return @{
    Output = $result
    ExitCode = $exitCode
  }
}

function Ensure-Repo {
  $insideRepo = Run-Git "rev-parse" "--is-inside-work-tree"
  if ($insideRepo.ExitCode -ne 0 -or "$($insideRepo.Output)".Trim() -ne "true") {
    throw "Not inside a git repository."
  }
}

function Ensure-Branch {
  param([string]$TargetBranch)

  $current = Run-Git "rev-parse" "--abbrev-ref" "HEAD"
  if ($current.ExitCode -ne 0) {
    throw "Failed to detect current branch."
  }

  $currentBranch = "$($current.Output)".Trim()
  if ($TargetBranch -eq "main" -and -not $AllowMain) {
    throw "Refusing to auto-push to main. Use -AllowMain if you really want that."
  }

  if ($currentBranch -eq $TargetBranch) {
    return
  }

  $localBranch = Run-Git "branch" "--list" $TargetBranch
  if ("$($localBranch.Output)".Trim()) {
    $checkout = Run-Git "checkout" $TargetBranch
    if ($checkout.ExitCode -ne 0) {
      throw "Failed to checkout local branch '$TargetBranch'."
    }
    return
  }

  $remoteBranch = Run-Git "ls-remote" "--heads" "origin" $TargetBranch
  if ("$($remoteBranch.Output)".Trim()) {
    $checkoutTracking = Run-Git "checkout" "-b" $TargetBranch "origin/$TargetBranch"
    if ($checkoutTracking.ExitCode -ne 0) {
      throw "Failed to create tracking branch '$TargetBranch'."
    }
    return
  }

  $createBranch = Run-Git "checkout" "-b" $TargetBranch
  if ($createBranch.ExitCode -ne 0) {
    throw "Failed to create branch '$TargetBranch'."
  }
}

function Run-Checks {
  if (-not $RunChecks) {
    return $true
  }

  Write-Host "Running checks: npm run lint"
  & npm run lint
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Checks failed. Skipping this sync cycle."
    return $false
  }

  return $true
}

Ensure-Repo
Ensure-Branch -TargetBranch $Branch

Write-Host "Auto sync started on branch '$Branch'. Interval: $IntervalSeconds sec."
Write-Host "Press Ctrl+C to stop."

while ($true) {
  $status = Run-Git "status" "--porcelain"
  $hasChanges = "$($status.Output)".Trim().Length -gt 0

  if ($status.ExitCode -ne 0) {
    Write-Host "Failed to read git status. Retrying..."
    Start-Sleep -Seconds $IntervalSeconds
    continue
  }

  if ($hasChanges) {
    $add = Run-Git "add" "-A"
    if ($add.ExitCode -ne 0) {
      Write-Host "Failed to stage changes. Retrying..."
      Start-Sleep -Seconds $IntervalSeconds
      continue
    }

    if (-not (Run-Checks)) {
      Start-Sleep -Seconds $IntervalSeconds
      continue
    }

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commit = Run-Git "commit" "-m" "chore(auto-sync): snapshot $timestamp"

    if ($commit.ExitCode -ne 0) {
      # No-op commits are normal if files changed between status/add/commit checks.
      Write-Host "No commit created this cycle."
      Start-Sleep -Seconds $IntervalSeconds
      continue
    }

    Write-Host "$($commit.Output)"

    $push = Run-Git "push" "-u" "origin" $Branch
    if ($push.ExitCode -ne 0) {
      Write-Host "Push failed. Resolve the issue and restart the script."
      Write-Host "$($push.Output)"
      break
    }

    Write-Host "$($push.Output)"
  }

  Start-Sleep -Seconds $IntervalSeconds
}
