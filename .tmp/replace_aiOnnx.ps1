$ts = (Get-Date).ToString('yyyyMMddHHmmss')
$backup = "cloudfunctions\aiOnnxInference_backup_$ts"
if (Test-Path "cloudfunctions\aiOnnxInference") {
  Move-Item -LiteralPath "cloudfunctions\aiOnnxInference" -Destination $backup -Force
}
Expand-Archive -LiteralPath "aiOnnxInference_clean.zip" -DestinationPath "cloudfunctions\aiOnnxInference" -Force
(Get-ChildItem -Path "cloudfunctions\aiOnnxInference" -Recurse -File | Measure-Object Length -Sum).Sum | Out-File replace_size.txt
Get-ChildItem -Path "cloudfunctions\aiOnnxInference" -Recurse -File | Sort-Object Length -Descending | Select-Object FullName,Length -First 40 | Out-String -Width 4096 | Out-File replace_out.txt
Write-Output "DONE"
