@echo off
chcp 65001 >nul
cls
echo ========================================
echo   RESET USER LIMITS
echo ========================================
echo.

echo This will delete all user limits and give
echo unlimited access to all users.
echo.
echo Are you sure? (Y/N)
set /p choice="> "

if /i not "%choice%"=="Y" (
    echo.
    echo Cancelled.
    pause
    exit /b 0
)

if exist "user_limits.json" (
    del user_limits.json
    echo [OK] Deleted user_limits.json
)

if exist "user_access.json" (
    del user_access.json
    echo [OK] Deleted user_access.json
)

echo.
echo ========================================
echo   LIMITS RESET!
echo ========================================
echo.
echo All users now have unlimited access.
echo Restart the bot for changes to take effect.
echo.
pause
