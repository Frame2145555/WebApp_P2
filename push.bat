@echo off
setlocal
cd /d "%~dp0"

set /p COMMIT_MESSAGE=Commit message (leave blank for "Update voting system"): 
if "%COMMIT_MESSAGE%"=="" set COMMIT_MESSAGE=Update voting system

echo.
echo Repository status:
git status

echo.
echo Adding files...
git add -A

echo.
echo Committing files...
git commit -m "%COMMIT_MESSAGE%"

echo.
echo Pushing current branch...
git push

echo Done!
pause
