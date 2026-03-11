@echo off
cd /d "%~dp0"
if not exist "%~dp0wechat_fill_message.ps1" (
  echo 找不到脚本：%~dp0wechat_fill_message.ps1
  pause
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -File "%~dp0wechat_fill_message.ps1"
pause
