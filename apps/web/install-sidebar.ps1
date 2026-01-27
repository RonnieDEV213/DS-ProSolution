# PowerShell script to automatically answer "N" to shadcn CLI prompts
$process = New-Object System.Diagnostics.Process
$process.StartInfo.FileName = "npx"
$process.StartInfo.Arguments = "shadcn@latest add sidebar"
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.RedirectStandardInput = $true
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true
$process.Start() | Out-Null

# Function to send "N" responses
$scriptBlock = {
    param($proc)
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Milliseconds 800
        try {
            $proc.StandardInput.WriteLine("N")
        } catch {}
    }
}

# Start background job to send responses
$job = Start-Job -ScriptBlock $scriptBlock -ArgumentList $process

# Read output
while (!$process.HasExited) {
    if ($null -ne $process.StandardOutput.Peek() -and $process.StandardOutput.Peek() -ge 0) {
        Write-Host $process.StandardOutput.ReadLine()
    }
    if ($null -ne $process.StandardError.Peek() -and $process.StandardError.Peek() -ge 0) {
        Write-Host $process.StandardError.ReadLine()
    }
    Start-Sleep -Milliseconds 100
}

# Cleanup
$job | Stop-Job
$job | Remove-Job
$process.WaitForExit()
Write-Host "Exit code: $($process.ExitCode)"
