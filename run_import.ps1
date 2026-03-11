# PowerShell import helper (Windows host)
$SqlPath = 'C:\Users\icile\OneDrive\Desktop\SMS\compostela_sms_postgresql_converted.sql'
$Host = if ($env:DBHOST) { $env:DBHOST } else { '127.0.0.1' }
$User = if ($env:DBUSER) { $env:DBUSER } else { 'pg_user' }
$Db = if ($env:DBNAME) { $env:DBNAME } else { 'compostela-sms' }

Write-Host "Importing $SqlPath into $User@$Host/$Db"

# If you don't want an interactive prompt, set PGPASSWORD env var before running:
# $env:PGPASSWORD = 'your_pg_password'

psql -h $Host -U $User -d $Db -f $SqlPath

Write-Host 'Import finished. Run sequence/boolean fixes in psql if needed.'
