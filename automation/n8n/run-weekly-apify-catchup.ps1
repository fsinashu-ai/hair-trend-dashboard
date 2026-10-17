param([switch]$CheckStartupOnly)

$ErrorActionPreference = "Stop"

$catchupContainerName = "n8n-n8n-1"
$catchupHelperPath = Join-Path $PSScriptRoot "check-weekly-execution.mjs"
$catchupLogDirectory = "C:\n8n\logs"
$catchupLogPath = Join-Path $catchupLogDirectory "apify-weekly-catchup.log"
$catchupDockerStartedHere = $false
$catchupExitCode = 0
$script:countFieldLabels = [ordered]@{
  importedCount = "imported"
  duplicateCount = "duplicates"
  truncatedCount = "truncated"
  savedCount = "saved"
  skippedCount = "skipped"
  receivedCount = "received"
  sourceMatchedCount = "sources"
  aiClassifiedCount = "classified"
  normalizedCount = "normalized"
  errorCount = "errors"
  previewCount = "preview"
}
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

function ConvertTo-CountLogValue {
  param([object]$Value)

  if ($Value -isnot [System.ValueType] -or $Value -is [bool]) {
    return $null
  }

  $numberText = [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture)
  $number = 0.0
  if (-not [double]::TryParse(
      $numberText,
      [Globalization.NumberStyles]::Float,
      [Globalization.CultureInfo]::InvariantCulture,
      [ref]$number
    ) -or [double]::IsNaN($number) -or [double]::IsInfinity($number) -or
    $number -lt 0 -or $number -ne [Math]::Floor($number)) {
    return $null
  }

  return $number.ToString("0", [Globalization.CultureInfo]::InvariantCulture)
}

function Find-WorkflowCountFields {
  param(
    [object]$Value,
    [System.Collections.IDictionary]$CountValues
  )

  if ($null -eq $Value) {
    return
  }

  if ($Value -is [System.Collections.IDictionary]) {
    foreach ($key in $Value.Keys) {
      if ($script:countFieldLabels.Contains($key)) {
        $displayValue = ConvertTo-CountLogValue -Value $Value[$key]
        if ($null -ne $displayValue -and -not $CountValues.Contains($key)) {
          $CountValues[$key] = $displayValue
        }
      }

      Find-WorkflowCountFields -Value $Value[$key] -CountValues $CountValues
    }
    return
  }

  if ($Value -is [pscustomobject]) {
    foreach ($property in $Value.PSObject.Properties) {
      if ($script:countFieldLabels.Contains($property.Name)) {
        $displayValue = ConvertTo-CountLogValue -Value $property.Value
        if ($null -ne $displayValue -and -not $CountValues.Contains($property.Name)) {
          $CountValues[$property.Name] = $displayValue
        }
      }

      Find-WorkflowCountFields -Value $property.Value -CountValues $CountValues
    }
    return
  }

  if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string]) {
    foreach ($item in $Value) {
      Find-WorkflowCountFields -Value $item -CountValues $CountValues
    }
  }
}

function Invoke-N8nWorkflow {
  param(
    [string]$WorkflowId,
    [string]$WorkflowName
  )

  $catchupOutput = @(
    docker exec `
    -e N8N_RUNNERS_BROKER_PORT=5680 `
    $catchupContainerName `
    n8n execute --id=$WorkflowId --rawOutput
  )
  $catchupExecutionExitCode = $LASTEXITCODE

  $countMessage = "counts unavailable"
  try {
    $outputText = $catchupOutput -join "`n"
    $parsedOutput = $outputText | ConvertFrom-Json -ErrorAction Stop
    $countValues = [ordered]@{}
    Find-WorkflowCountFields -Value $parsedOutput -CountValues $countValues

    $requiredCountFields = @("importedCount", "duplicateCount", "truncatedCount")
    $hasRequiredCountFields = $true
    foreach ($fieldName in $requiredCountFields) {
      if (-not $countValues.Contains($fieldName)) {
        $hasRequiredCountFields = $false
        break
      }
    }

    if ($hasRequiredCountFields) {
      $countParts = New-Object "System.Collections.Generic.List[string]"
      foreach ($fieldName in $script:countFieldLabels.Keys) {
        if ($countValues.Contains($fieldName)) {
          [void]$countParts.Add("$($script:countFieldLabels[$fieldName])=$($countValues[$fieldName])")
        }
      }
      $countMessage = $countParts -join " "
    }
  } catch {
    $countMessage = "counts unavailable"
  }

  Write-CatchupLog "$WorkflowName $countMessage"

  if ($catchupExecutionExitCode -ne 0) {
    throw "$WorkflowName workflow failed with exit code $catchupExecutionExitCode."
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
