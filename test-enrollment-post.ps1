$EnrollmentData = @{
    student_id = 2
    firstName = "Test"
    lastName = "Student"
    birthdate = "2010-01-15"
    sex = "Male"
    age = 14
    hasLRN = "no"
    gradeLevel = 11
    track = "academic"
    schoolYear = "2023-2024"
    returningLearner = "no"
    hasPWD = "no"
    is4Ps = "no"
    isIP = "no"
    currentSitio = "Purok 1"
    currentCountry = "Philippines"
    currentProvince = "Davao de Oro"
    currentMunicipality = "Compostela"
    currentBarangay = "Poblacion"
    learningModality = "modular-print"
    certification = $true
    dataPrivacy = $true
} | ConvertTo-Json

Write-Host "Testing enrollment POST endpoint..."
Write-Host "URL: http://localhost:3002/api/enrollments"
Write-Host "Payload: $EnrollmentData"
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3002/api/enrollments" `
        -Method POST `
        -ContentType "application/json" `
        -Body $EnrollmentData `
        -ErrorAction Stop
    
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Response:"
    $response.Content | ConvertFrom-Json | ConvertTo-Json
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Response:"
    $_.ErrorDetails.Message
}
