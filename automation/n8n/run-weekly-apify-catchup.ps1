param([switch]$CheckStartupOnly)

$ErrorActionPreference = "Stop"

$catchupContainerName = "n8n-n8n-1"
$catchupHelperPath = Join-Path $PSScriptRoot "check-weekly-execution.mjs"
$catchupLogDirectory = "C:\n8n\logs"
$catchupLogPath = Join-Path $catchupLogDirectory "apify-weekly-catchup.log"
$catchupDockerStartedHere = $false
$catchupExitCode = 0
$catchupWorkflows = @(
  @{ Id = "2H8r0zTnuNhJq6nO"; Name = "Instagram" },
  @{ Id = "QtaYwMxUYhZ8ercb"; Name = "TikTok" }
)

function Write-CatchupLog {
  param([string]$Message)

  New-Item -ItemType Directory -Path $catchupLogDirectory -Force | Out-Null
  $catchupTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
  Add-Content -LiteralPath $catchupLogPath -Value "[$catchupTimestamp] $Message"
}

function Test-DockerEngineAvailable {
  # Windows PowerShell 5.1 turns native stderr into errors even when redirected.
  $savedPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    docker info --format "{{.ServerVersion}}" *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $savedPreference
  }
}

function Wait-ForDockerEngine {
  for ($catchupAttempt = 0; $catchupAttempt -lt 60; $catchupAttempt += 1) {
    if (Test-DockerEngineAvailable) {
      return $true
    }

    Start-Sleep -Seconds 5
  }

  return $false
}

function Wait-ForN8nContainer {
  for ($catchupAttempt = 0; $catchupAttempt -lt 60; $catchupAttempt += 1) {
    $savedPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      $catchupRunning = docker inspect --format "{{.State.Running}}" $catchupContainerName 2>$null
      $catchupInspectExit = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $savedPreference
    }

    if ($catchupInspectExit -eq 0 -and $catchupRunning -eq "true") {
      return $true
    }

    if ($catchupAttempt -eq 0) {
      docker start $catchupContainerName 2>$null | Out-Null
    }

    Start-Sleep -Seconds 5
  }

  return $false
}

function Test-WorkflowSucceededThisWeek {
  param(
    [string]$WorkflowId,
    [string]$WeekStartUtc
  )

  $catchupResult = docker exec $catchupContainerName node /tmp/check-weekly-execution.mjs $WorkflowId $WeekStartUtc 2>$null
  return $catchupResult -eq "yes"
}

function Invoke-N8nWorkflow {
  param(
    [string]$WorkflowId,
    [string]$WorkflowName
  )

  docker exec `
    -e N8N_RUNNERS_BROKER_PORT=5680 `
    $catchupContainerName `
    n8n execute --id=$WorkflowId --rawOutput | Out-Null

  if ($LASTEXITCODE -ne 0) {
    throw "$WorkflowName workflow failed with exit code $LASTEXITCODE."
  }
}

try {
  Write-CatchupLog "Catch-up check started."

  if (-not (Test-DockerEngineAvailable)) {
    Write-CatchupLog "Docker Desktop is stopped; starting it for this weekly task."
    $catchupDockerStartedHere = $true
    docker desktop start --timeout 300 | Out-Null

    if ($LASTEXITCODE -ne 0) {
      throw "Docker Desktop could not be started."
    }
  }

  if (-not (Wait-ForDockerEngine)) {
    throw "Docker Desktop did not become ready within five minutes."
  }

  if (-not (Wait-ForN8nContainer)) {
    throw "n8n container did not become ready within five minutes."
  }

  if ($CheckStartupOnly) {
    Write-CatchupLog "Startup check succeeded; Docker and n8n are ready. No workflows executed."
    exit 0
  }

  docker cp $catchupHelperPath "${catchupContainerName}:/tmp/check-weekly-execution.mjs" 2>$null | Out-Null

  if ($LASTEXITCODE -ne 0) {
    throw "Could not copy the weekly execution checker into the n8n container."
  }

  $catchupNow = Get-Date
  $catchupDaysSinceMonday = (([int]$catchupNow.DayOfWeek + 6) % 7)
  $catchupWeekStartLocal = $catchupNow.Date.AddDays(-$catchupDaysSinceMonday)
  $catchupWeekStartUtc = $catchupWeekStartLocal.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss.fff")

  foreach ($catchupWorkflow in $catchupWorkflows) {
    if (Test-WorkflowSucceededThisWeek -WorkflowId $catchupWorkflow.Id -WeekStartUtc $catchupWeekStartUtc) {
      Write-CatchupLog "$($catchupWorkflow.Name) already succeeded this week; skipped."
      continue
    }

    Write-CatchupLog "$($catchupWorkflow.Name) is missing this week; executing."
    Invoke-N8nWorkflow -WorkflowId $catchupWorkflow.Id -WorkflowName $catchupWorkflow.Name
    Write-CatchupLog "$($catchupWorkflow.Name) catch-up succeeded."
  }

  Write-CatchupLog "Catch-up check completed."
} catch {
  Write-CatchupLog "Catch-up failed: $($_.Exception.Message)"
  $catchupExitCode = 1
} finally {
  if ($catchupDockerStartedHere) {
    try {
      Write-CatchupLog "Stopping Docker Desktop started by this weekly task."
      docker desktop stop --timeout 120 | Out-Null

      if ($LASTEXITCODE -ne 0) {
        throw "Docker Desktop could not be stopped."
      }

      Write-CatchupLog "Docker Desktop stopped."
    } catch {
      Write-CatchupLog "Docker Desktop stop failed: $($_.Exception.Message)"
      $catchupExitCode = 1
    }
  }
}

exit $catchupExitCode
