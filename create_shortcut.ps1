$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (!$ScriptDir) { $ScriptDir = $PSScriptRoot }
if (!$ScriptDir) { $ScriptDir = Get-Location }

$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut($Desktop + '\FrpOku.lnk')
$Shortcut.TargetPath = Join-Path $ScriptDir 'baslat.bat'
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = 'FrpOku FastReport Okuyucu ve SQL Dogrulayici'
$Shortcut.Save()
Write-Host 'Masaustu kisayolu basariyla guncellendi!'
