@echo off
setlocal

cd /d "%~dp0"
title hair-trend-dashboard

echo.
echo ========================================
echo hair-trend-dashboard
echo ========================================
echo.
echo This window starts the app for local use.
echo You can close the app later with Ctrl + C.
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found.
  echo Please install Node.js LTS from:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo The app looks already running on port 3000.
  echo Opening http://localhost:3000
  echo.
  start "" "http://localhost:3000"
  echo If the page does not open, close other app windows and run this file again.
  echo.
  pause
  exit /b 0
)

if not exist "node_modules\" (
  echo First setup: installing packages...
  echo This can take a few minutes only the first time.
  echo.
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

if not exist ".env.local" (
  if exist ".env.local.example" (
    copy ".env.local.example" ".env.local" >nul
    echo Created .env.local from .env.local.example.
  ) else (
    type nul > ".env.local"
    echo Created empty .env.local.
  )
  echo Add Supabase or Gemini keys later when you need them.
  echo.
)

echo Opening http://localhost:3000
echo Starting development server...
echo.
echo Keep this window open while using the app.
echo Stop the app with Ctrl + C in this window.
echo.

start "" "http://localhost:3000"
call npm.cmd run dev

echo.
pause
