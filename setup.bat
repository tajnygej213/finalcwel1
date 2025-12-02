@echo off
chcp 65001 >nul
cls
echo ========================================
echo   DISCORD BOT - SETUP
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found!
    echo.
    echo Download Node.js from: https://nodejs.org/
    echo After installation, run this script again.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js installed:
node --version
echo.

if not exist ".env" (
    echo [WARNING] .env file not found
    echo.
    echo Do you want to create .env file now? (Y/N)
    set /p choice="> "
    if /i "%choice%"=="Y" (
        copy .env.example .env >nul
        echo [OK] .env file created - please edit it now!
        notepad .env
        echo.
        echo After saving .env file, run this script again.
        pause
        exit /b 0
    ) else (
        echo.
        echo Please create .env file manually and run this script again.
        pause
        exit /b 1
    )
)

echo [OK] .env file exists
echo.

echo Installing dependencies...
echo.
call npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   INSTALLATION COMPLETE!
echo ========================================
echo.
echo You can now start the bot:
echo    - Run: start.bat
echo    - Or type: node index.js
echo.
pause
