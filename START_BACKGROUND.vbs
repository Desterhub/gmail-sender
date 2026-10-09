' Starts the Gmail Bulk Sender in the background without a command prompt window.
' To stop the server later, simply double-click STOP.bat
Set WshShell = CreateObject("WScript.Shell")
strPath = WshShell.CurrentDirectory
WshShell.Run "cmd /c """ & strPath & "\START.bat""", 0, False
