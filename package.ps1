# Chrome扩展打包脚本
$version = (Get-Content "manifest.json" | ConvertFrom-Json).version
$zipName = "interstellar-nova-v$version.zip"
$exclude = @(".git", ".vscode", ".gitignore", "*.zip", "package.ps1", "README.md", "CHANGELOG.md", "task.md", "implementation_plan.md", "walkthrough.md", "node_modules")

Write-Host "📦 正在打包版本 $version ..." -ForegroundColor Cyan

# 移除旧的压缩包
if (Test-Path $zipName) {
    Remove-Item $zipName
}

# 获取所有文件并过滤
$files = Get-ChildItem -Recurse | Where-Object {
    $path = $_.FullName
    $skip = $false
    foreach ($pattern in $exclude) {
        if ($path -like "*$pattern*") {
            $skip = $true
            break
        }
    }
    return -not $skip
}

# 压缩文件
Compress-Archive -Path $files -DestinationPath $zipName -Force

Write-Host "✅ 打包完成: $zipName" -ForegroundColor Green
Write-Host "📂 文件位置: $(Resolve-Path $zipName)" -ForegroundColor Gray
