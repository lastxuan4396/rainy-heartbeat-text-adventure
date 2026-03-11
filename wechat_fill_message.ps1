param(
    [string]$Message,
    [switch]$AutoSend,
    [ValidateSet("AltS", "Enter", "CtrlEnter")]
    [string]$SendMode = "AltS",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class User32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@

function Get-WeChatWindow {
    $candidates = @(
        (Get-Process Weixin -ErrorAction SilentlyContinue),
        (Get-Process WeChatAppEx -ErrorAction SilentlyContinue)
    ) | Where-Object { $_ -and $_.MainWindowHandle -ne 0 }

    return $candidates | Select-Object -First 1
}

function Restore-Clipboard {
    param(
        [AllowNull()]
        [string]$Text,
        [bool]$HadText
    )

    if ($HadText) {
        Set-Clipboard -Value $Text
    }
}

function Send-WeChatMessage {
    param(
        [ValidateSet("AltS", "Enter", "CtrlEnter")]
        [string]$Mode
    )

    Start-Sleep -Milliseconds 350

    switch ($Mode) {
        "AltS" {
            [System.Windows.Forms.SendKeys]::SendWait("%s")
        }
        "Enter" {
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        }
        "CtrlEnter" {
            [System.Windows.Forms.SendKeys]::SendWait("^{ENTER}")
        }
    }
}

if ([string]::IsNullOrWhiteSpace($Message)) {
    Write-Host ""
    Write-Host "把你想发送的内容输入在下面。" -ForegroundColor Cyan
    Write-Host "如果要换行，先按 Ctrl+C 取消，再用参数 -Message 传入完整文本。" -ForegroundColor DarkGray
    $Message = Read-Host "消息内容"
}

if ([string]::IsNullOrWhiteSpace($Message)) {
    throw "消息不能为空。"
}

Write-Host ""
if (-not $DryRun) {
    Write-Host "请先手动打开微信，并点进你要发送的那个人的聊天窗口。" -ForegroundColor Yellow
    Write-Host "准备好之后，回到这里按一次回车。" -ForegroundColor Yellow
    [void](Read-Host "继续")
}

$wechat = Get-WeChatWindow
if (-not $wechat) {
    throw "没有找到已打开的微信窗口。请先启动并登录微信电脑版。"
}

if ($DryRun) {
    Write-Host ""
    Write-Host "DryRun: 已找到微信窗口，脚本逻辑正常，未执行粘贴或发送。" -ForegroundColor Green
    exit 0
}

$clipboardText = $null
$hadClipboardText = $false

try {
    try {
        $clipboardText = Get-Clipboard -Raw
        $hadClipboardText = $true
    }
    catch {
        $clipboardText = $null
        $hadClipboardText = $false
    }

    Set-Clipboard -Value $Message

    [void][User32]::ShowWindowAsync($wechat.MainWindowHandle, 5)
    Start-Sleep -Milliseconds 300
    [void][User32]::SetForegroundWindow($wechat.MainWindowHandle)
    Start-Sleep -Milliseconds 500

    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 500

    if ($AutoSend) {
        Send-WeChatMessage -Mode $SendMode

        Write-Host ""
        Write-Host "已尝试粘贴并发送消息，当前发送方式：$SendMode" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "消息已经粘贴到当前微信聊天框里，请你确认内容无误后手动发送。" -ForegroundColor Green
    }
}
finally {
    Restore-Clipboard -Text $clipboardText -HadText $hadClipboardText
}
