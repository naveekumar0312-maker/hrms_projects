$p = ".\App.tsx"
$c = Get-Content $p -Raw

# Remove the accidentally inserted literal text
$c = $c.Replace('<SafeAreaProvider>`r`n      <StatusBar hidden={true} />', '<SafeAreaProvider>')

# Add StatusBar import if missing
if ($c -notmatch "from 'react-native'") {
    $c = $c -replace "(?m)^import React from 'react';", "import React from 'react';`r`nimport { StatusBar } from 'react-native';"
}

# Add StatusBar as a real JSX element
$c = $c.Replace('<SafeAreaProvider>', "<SafeAreaProvider>`r`n      <StatusBar hidden={true} />")

Set-Content -Path $p -Value $c -Encoding utf8
Write-Host "StatusBar JSX and import fixed." -ForegroundColor Green

Select-String -Path $p -Pattern 'react-native|StatusBar|SafeAreaProvider'
