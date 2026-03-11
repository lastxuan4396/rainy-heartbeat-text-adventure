Option Explicit

Dim shell
Dim basePath
Dim scriptPath
Dim command

Set shell = CreateObject("WScript.Shell")
basePath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
scriptPath = basePath & "\wechat_fill_message.ps1"

command = """" & "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" & """" & " -ExecutionPolicy Bypass -NoLogo -File " & """" & scriptPath & """"

shell.Run command, 1, False
