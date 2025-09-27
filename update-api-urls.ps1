$files = @(
    "Frontend\Frontend\src\routes\chat-replicas\+page.svelte",
    "Frontend\Frontend\src\routes\gallery.svelte", 
    "Frontend\Frontend\src\routes\train-models\+page.svelte",
    "Frontend\Frontend\src\lib\components\wizard\Step7ReviewSubmit.svelte",
    "Frontend\Frontend\src\lib\components\wizard\Step5ProfileImage.svelte"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Updating $file"
        $content = Get-Content $file -Raw
        $content = $content -replace '\$\{API_BASE_URL\}([^`"'']*)', 'apiUrl("$1")'
        $content = $content -replace "fetch\('http://localhost:4000([^']*)'", "fetch(apiUrl('`$1')"
        Set-Content $file $content
    }
}