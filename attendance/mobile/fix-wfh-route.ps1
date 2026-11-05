$path = ".\App.tsx"
$content = Get-Content $path -Raw

if ($content -notmatch 'name="WFH"') {
    $marker = 'name="PersonalInfo"'
    $index = $content.IndexOf($marker)

    if ($index -lt 0) {
        Write-Host "ERROR: PersonalInfo route not found." -ForegroundColor Red
        exit
    }

    $start = $content.LastIndexOf('<Stack.Screen', $index)

    if ($start -lt 0) {
        Write-Host "ERROR: Stack.Screen not found." -ForegroundColor Red
        exit
    }

    $route = "          <Stack.Screen`r`n            name=`"WFH`"`r`n            component={WFHScreen}`r`n            options={{ headerShown: false }}`r`n          />`r`n`r`n"
    $content = $content.Insert($start, $route)
    Set-Content -Path $path -Value $content -Encoding utf8
    Write-Host "WFH route added." -ForegroundColor Green
}
else {
    Write-Host "WFH route already exists." -ForegroundColor Yellow
}

Select-String -Path $path -Pattern 'WFHScreen|name="WFH"|name="PersonalInfo"'
