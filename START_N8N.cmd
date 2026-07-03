@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Start n8n

set "DOCKER_DESKTOP=C:\Program Files\Docker\Docker\Docker Desktop.exe"
set "N8N_DIR=C:\n8n"
set "N8N_URL=http://localhost:5678"

echo.
echo ========================================
echo Start Docker Desktop and n8n
echo ========================================
echo.

if not exist "%N8N_DIR%\compose.yaml" (
  echo compose.yaml was not found in C:\n8n.
  echo Check that C:\n8n\compose.yaml exists.
  echo.
  pause
  exit /b 1
)

where docker.exe >nul 2>nul
if errorlevel 1 (
  echo Docker was not found.
  echo Install or start Docker Desktop, then try again.
  echo.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  if not exist "%DOCKER_DESKTOP%" (
    echo Docker Desktop was not found at:
    echo %DOCKER_DESKTOP%
    echo.
    pause
    exit /b 1
  )

  echo Starting Docker Desktop...
  start "" "%DOCKER_DESKTOP%"
)

set /a DOCKER_TRIES=0
:wait_for_docker
docker info >nul 2>nul
if not errorlevel 1 goto docker_ready

set /a DOCKER_TRIES+=1
if !DOCKER_TRIES! GEQ 36 goto docker_timeout

echo Waiting for Docker Desktop... !DOCKER_TRIES!/36
timeout /t 5 /nobreak >nul
goto wait_for_docker

:docker_timeout
echo.
echo Docker Desktop did not become ready.
echo Open Docker Desktop and check its error message, then try again.
echo.
pause
exit /b 1

:docker_ready
echo Docker Desktop is ready.
echo Starting n8n...
docker compose -f "%N8N_DIR%\compose.yaml" up -d
if errorlevel 1 (
  echo.
  echo n8n could not be started.
  echo Check Docker Desktop, then try again.
  echo.
  pause
  exit /b 1
)

set /a N8N_TRIES=0
:wait_for_n8n
netstat -ano | findstr ":5678" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 goto n8n_ready

set /a N8N_TRIES+=1
if !N8N_TRIES! GEQ 24 goto open_n8n

echo Waiting for n8n... !N8N_TRIES!/24
timeout /t 5 /nobreak >nul
goto wait_for_n8n

:n8n_ready
echo n8n is ready.

:open_n8n
echo Opening %N8N_URL%
start "" "%N8N_URL%"
echo.
echo You may close this window. Docker Desktop must stay running.
timeout /t 5 /nobreak >nul
exit /b 0
