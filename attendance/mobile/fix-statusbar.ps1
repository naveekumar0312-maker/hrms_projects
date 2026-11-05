$p = ".\App.tsx"
$c = Get-Content $p -Raw

if ($c -notmatch 'import\s+\{\s*StatusBar\s*\}\s+from\s+''react-native''') {
    $c = $c -replace "(?m)^import React from 'react';", "import React from 'react';`r`nimport { StatusBar } from 'react-native';"
}

$c = $c -replace '<SafeAreaProvider>', '<SafeAreaProvider>`r`n      <StatusBar hidden={true} />'

$c = $c -replace '><StatusBar hidden=\{true\} />', '><StatusBar hidden={true} />'

Set-Content -Path $p -Value $c -Encoding utf8
Write-Host "Status bar configuration updated." -ForegroundColor Green
Select-String -Path $p -Pattern 'StatusBar|SafeAreaProvider'
