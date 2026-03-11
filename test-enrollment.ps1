$body = @{
    student_id = 1
    firstName = 'John'
    lastName = 'Doe'
    middleName = 'Patrick'
    birthdate = '2008-05-20'
    sex = 'Male'
    age = 16
    placeOfBirth = 'Manila'
    hasLRN = 'yes'
    lrn = 'LRN12345'
    returningLearner = 'yes'
    isIP = 'no'
    is4Ps = 'yes'
    disability = @('blind', 'speech-language')
    disabilityDetails = 'Severe vision impairment'
    learningModality = 'modular-print'
    currentSitio = 'Sitio Tagpuan'
    currentZipCode = '1000'
    permSitio = 'Sitio Pag-asa'
    permZipCode = '2000'
    sameAsCurrentAddress = $false
    fatherName = 'Peter Doe'
    fatherContact = '09123456789'
    motherMaidenName = 'Maria Santos'
    motherContact = '09987654321'
    guardianName = 'Tita Ana Cruz'
    guardianContact = '09555555555'
    lastSchoolAttended = 'ABC Elementary School'
    semester = 'First'
    certification = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3003/api/enrollments' -Method Post -Body $body -ContentType 'application/json'
    Write-Host "Success!"
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "Error Status: " $_.Exception.Response.StatusCode
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Error Details: " ($errorDetails | ConvertTo-Json)
}
