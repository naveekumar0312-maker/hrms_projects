$path = ".\src\pages\UniversalLogin.tsx"
$content = Get-Content $path -Raw

if ($content -notmatch "const \[identifier, setIdentifier\]") {
  throw "STOP: identifier state not found. No changes made."
}

if ($content -notmatch "attendance_remembered_identifier") {
  $content = $content.Replace(
    "const [identifier, setIdentifier] = useState('')",
    @"
const [identifier, setIdentifier] = useState(
    () => localStorage.getItem('attendance_remembered_identifier') || ''
  )
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem('attendance_remember_me') === 'true'
  )
"@
  )
}

if ($content -notmatch "attendance_remembered_identifier") {
  throw "STOP: Remember me state replacement failed."
}

if ($content -notmatch "attendance_remember_me.*true") {
  $needle = @"
      setLoading(true)
      setError('')
"@
  $replacement = @"
      setLoading(true)
      setError('')

      if (rememberMe) {
        localStorage.setItem('attendance_remember_me', 'true')
        localStorage.setItem('attendance_remembered_identifier', identifier.trim())
      } else {
        localStorage.removeItem('attendance_remember_me')
        localStorage.removeItem('attendance_remembered_identifier')
      }
"@
  if (-not $content.Contains($needle)) {
    throw "STOP: Login insertion point not found. Restore backup if needed."
  }
  $content = $content.Replace($needle, $replacement)
}

if ($content -notmatch 'className="login-options"') {
  $needle = @"
            <button
              type="submit"
              className="login-submit"
"@
  $replacement = @"
            <div className="login-options">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setRememberMe(checked)
                    if (!checked) {
                      localStorage.removeItem('attendance_remember_me')
                      localStorage.removeItem('attendance_remembered_identifier')
                    }
                  }}
                  disabled={loading}
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="login-forgot"
                onClick={() => setError('Please contact your administrator to reset your password.')}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="login-submit"
"@
  if (-not $content.Contains($needle)) {
    throw "STOP: Sign In button insertion point not found."
  }
  $content = $content.Replace($needle, $replacement)
}

$content = [regex]::Replace(
  $content,
  '(?s)\s*<p className="login-security-note">\s*Sign in with your registered account credentials\.\s*</p>',
  ''
)

$content = $content.Replace(
  'style={{ backgroundColor: panelColor }}',
  "style={{ '--brand-panel-color': panelColor } as CSSProperties}"
)

if ($content -notmatch "type CSSProperties") {
  $content = $content.Replace(
    "import { useContext, useEffect, useState, type FormEvent } from 'react'",
    "import { useContext, useEffect, useState, type FormEvent, type CSSProperties } from 'react'"
  )
}

Set-Content -Path $path -Value $content -Encoding utf8
Write-Host "UniversalLogin.tsx updated. Verify the file before building." -ForegroundColor Green
