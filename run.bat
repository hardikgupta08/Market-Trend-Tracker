@echo off
rem Runs run.ps1 without needing to change the PowerShell execution policy.
rem Usage: run.bat [-Dev] [-Open] [-Setup] [-Port 8000] [-RefreshMinutes 1]
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
