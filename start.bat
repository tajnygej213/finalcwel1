@echo off
chcp 65001 >nul
cls
echo ========================================
echo   DISCORD BOT - START
echo ========================================
echo.

if not exist ".env" (
    echo [ERROR] .env file not found
    echo.
    echo Run setup.bat first!
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [ERROR] Dependencies not installed
    echo.
    echo Run setup.bat first!
    echo.
    pause
    exit /b 1
)

echo Starting bot...
echo.
echo To stop the bot, press Ctrl+C
echo.
echo ========================================
echo.

node index.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Bot crashed!
    echo.
    pause
)
