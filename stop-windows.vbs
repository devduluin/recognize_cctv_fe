Option Explicit
Dim shell, files, script
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
script = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "scripts\run-windows.ps1")
If Not files.FileExists(script) Then
    MsgBox "Runner script not found. Keep stop-windows.vbs in the project folder and create a Desktop shortcut to it.", vbExclamation, "Visitor Counter"
    WScript.Quit 1
End If
shell.Run "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & script & """ -Background -Stop", 0, False
