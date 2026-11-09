# Brücke zwischen run.js und InDesign über COM.
#
# Normalbetrieb (-ProgId): bleibt offen und liest Befehle zeilenweise von
# stdin, damit das COM-Objekt und der Win32-Teil nur einmal entstehen.
#   RUN <id> <sprache> <quelldatei> <ausgabedatei>
#       DoScript mit dem Quelltext aus der Datei; schreibt {ok,value|error}
#       als UTF-8-JSON in die Ausgabedatei, dann "DONE <id> <dialoge>".
#   DIALOGS <id>      sichtbare Dialogfenster (#32770) von InDesign
#   PID <prozess-id>  welcher InDesign-Prozess für DIALOGS gilt
# Felder sind durch Tabulatoren getrennt; Pfade kommen so ohne Quoting an.
#
# Nebenmodus (-Dismiss): läuft einmal, während der Normalbetrieb in einem
# hängenden DoScript feststeckt. Fotografiert die genannten Dialoge
# (PrintWindow, auch wenn sie verdeckt sind) und schließt sie mit WM_CLOSE.
param(
  [string]$ProgId = '',
  [switch]$Dismiss,
  [int]$ProcId = 0,
  [string]$Handles = '',
  [string]$ShotDir = ''
)
$ErrorActionPreference = 'Stop'

Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class LiveWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public static string Dialogs(uint pid) {
    var r = new List<string>();
    EnumWindows((h, l) => {
      uint p; GetWindowThreadProcessId(h, out p);
      if (p == pid && IsWindowVisible(h)) {
        var sb = new StringBuilder(64); GetClassName(h, sb, 64);
        if (sb.ToString() == "#32770") r.Add(h.ToInt64().ToString());
      }
      return true;
    }, IntPtr.Zero);
    return string.Join(",", r);
  }
}
"@
[LiveWin]::SetProcessDPIAware() | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding $false

if ($Dismiss) {
  Add-Type -AssemblyName System.Drawing
  foreach ($s in ($Handles -split ',' | Where-Object { $_ })) {
    $h = [IntPtr][long]$s
    if (-not [LiveWin]::IsWindow($h)) { continue }
    if ($ShotDir) {
      $b = New-Object System.Drawing.Bitmap 800, 500
      $g = [System.Drawing.Graphics]::FromImage($b)
      $hdc = $g.GetHdc(); [LiveWin]::PrintWindow($h, $hdc, 2) | Out-Null; $g.ReleaseHdc($hdc)
      $b.Save((Join-Path $ShotDir ("dialog-" + $s + ".png")))
    }
    [LiveWin]::PostMessage($h, 0x10, [IntPtr]0, [IntPtr]0) | Out-Null
    "CLOSED " + $s
  }
  exit 0
}

[Console]::InputEncoding = $utf8
$app = New-Object -ComObject $ProgId
$procId = [uint32]0
[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $p = $line.Split("`t")
  switch ($p[0]) {
    'PID' { $procId = [uint32]$p[1]; [Console]::Out.WriteLine('OK') }
    'DIALOGS' {
      $d = if ($procId) { [LiveWin]::Dialogs($procId) } else { '' }
      [Console]::Out.WriteLine("DIALOGS`t" + $p[1] + "`t" + $d)
    }
    'RUN' {
      $id = $p[1]; $lang = [int]$p[2]; $src = $p[3]; $out = $p[4]
      try {
        $r = $app.DoScript([IO.File]::ReadAllText($src, $utf8), $lang)
        $obj = @{ ok = $true; value = $(if ($null -eq $r) { $null } else { [string]$r }) }
      } catch {
        $obj = @{ ok = $false; error = $_.Exception.Message }
      }
      [IO.File]::WriteAllText($out, (ConvertTo-Json $obj -Compress), $utf8)
      $d = if ($procId) { [LiveWin]::Dialogs($procId) } else { '' }
      [Console]::Out.WriteLine("DONE`t" + $id + "`t" + $d)
    }
    default { [Console]::Out.WriteLine("ERR`tunknown command") }
  }
  [Console]::Out.Flush()
}
