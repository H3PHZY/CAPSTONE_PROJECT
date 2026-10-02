# Copy the Industrial Polyethylene (HDPE) image to the marketplace folder.
# Run this from the project root after saving the image in Cursor's assets.
$src = "C:\Users\dell\.cursor\projects\c-Users-dell-OneDrive-Desktop-Capstone-Project-EcoLoop\assets\c__Users_dell_AppData_Roaming_Cursor_User_workspaceStorage_41196e4cb3f4fd2cbad0aeeccb1e50f6_images_Image__Industrial_Polyethylene__HDPE__-e0dd98ca-cd9f-45fb-9810-c2a3c8ca8602.png"
$dest = Join-Path $PSScriptRoot "..\public\marketplace\hdpe.png"
if (Test-Path $src) {
  Copy-Item $src $dest -Force
  Write-Host "Copied HDPE image to public/marketplace/hdpe.png"
} else {
  Write-Host "Source image not found. Please copy the three-bins image to: $dest"
}
