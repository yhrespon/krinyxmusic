$ErrorActionPreference = 'Stop'

function Read-SecretValue([string]$Prompt) {
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Read-PlainValue([string]$Prompt, [string]$Default = '') {
  $value = Read-Host -Prompt "$Prompt [$Default]"
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
  return $value
}

$database = Read-SecretValue 'DATABASE_URL PostgreSQL (saisie masquée)'
$jwt = Read-SecretValue 'JWT_SECRET (saisie masquée)'
$spotifyKey = Read-SecretValue 'SPOTIFY_TOKEN_ENCRYPTION_KEY (saisie masquée)'
$gmailUser = Read-PlainValue 'GMAIL_USER facultatif'
$gmailPassword = if ($gmailUser) { Read-SecretValue 'GMAIL_APP_PASSWORD facultatif (saisie masquée)' } else { '' }
$spotifyId = Read-PlainValue 'SPOTIFY_CLIENT_ID facultatif'
$spotifySecret = if ($spotifyId) { Read-SecretValue 'SPOTIFY_CLIENT_SECRET facultatif (saisie masquée)' } else { '' }

@"
NODE_ENV=development
PORT=3000
APP_URL=http://127.0.0.1:3000
DATABASE_URL=$database
DATABASE_SSL=true
JWT_SECRET=$jwt
SPOTIFY_TOKEN_ENCRYPTION_KEY=$spotifyKey
SPOTIFY_CLIENT_ID=$spotifyId
SPOTIFY_CLIENT_SECRET=$spotifySecret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
GMAIL_USER=$gmailUser
GMAIL_APP_PASSWORD=$gmailPassword
TLS_CERT_FILE=
TLS_KEY_FILE=
FORCE_HTTPS=false
TRUST_PROXY=false
YTDLP_COOKIES_FILE=
YTDLP_COOKIES_FROM_BROWSER=
YTDLP_JS_RUNTIME=
YTDLP_FFMPEG_LOCATION=
"@ | Set-Content -Path .env -Encoding UTF8

Write-Host '.env local créé. Ne le partagez pas et ne le commitez pas.' -ForegroundColor Green
