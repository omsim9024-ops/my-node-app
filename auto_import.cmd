@echo off
REM Automatic import of compostela_sms_postgresql_converted.sql into compostela-sms
REM Uses default postgres user and assumes Postgres is running locally on 127.0.0.1:5432
REM Non-interactive: if Postgres requires a password, set environment variable PGPASSWORD before running.

setlocal
set "SQLPATH=C:\Users\icile\OneDrive\Desktop\SMS\compostela_sms_postgresql_converted.sql"
set "DBHOST=127.0.0.1"
set "DBUSER=postgres"
set "DBNAME=compostela-sms"

REM find psql
where psql >nul 2>&1
if errorlevel 1 (
  if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" (
    set "PSQL_EXE=C:\Program Files\PostgreSQL\14\bin\psql.exe"
  ) else if exist "C:\Program Files\PostgreSQL\13\bin\psql.exe" (
    set "PSQL_EXE=C:\Program Files\PostgreSQL\13\bin\psql.exe"
  ) else (
    echo psql not found on PATH and common install locations not found.
    echo Please install PostgreSQL client tools or add psql to PATH.
    echo You can set environment variable PGPASSWORD to avoid interactive password prompts.
    exit /b 1
  )
) else (
  set "PSQL_EXE=psql"
)

echo Testing connection to Postgres as %DBUSER%@%DBHOST%...
"%PSQL_EXE%" -h %DBHOST% -U %DBUSER% -d postgres -w -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
  echo Failed to connect non-interactively. If Postgres requires a password, set environment variable PGPASSWORD before running this script.
  echo Example: set PGPASSWORD=your_pg_password
  exit /b 1
)

echo Connection OK.

echo Checking if database %DBNAME% exists...
for /f "usebackq tokens=*" %%a in (`"%PSQL_EXE%" -h %DBHOST% -U %DBUSER% -d postgres -w -tAc "SELECT 1 FROM pg_database WHERE datname='%DBNAME%';"`) do set "DB_EXISTS=%%a"

if "%DB_EXISTS%"=="1" (
  echo Database %DBNAME% already exists.
) else (
  echo Creating database %DBNAME%...
  "%PSQL_EXE%" -h %DBHOST% -U %DBUSER% -d postgres -w -c "CREATE DATABASE \"%DBNAME%\";" || (
    echo Failed to create database %DBNAME%.
    exit /b 1
  )
)

echo Importing SQL file %SQLPATH% into %DBNAME%...
"%PSQL_EXE%" -h %DBHOST% -U %DBUSER% -d "%DBNAME%" -w -f "%SQLPATH%"
if errorlevel 1 (
  echo Import failed. Check the psql output above for details.
  exit /b 1
)

echo Import completed successfully.
echo Next: reset sequences and convert tinyint flags if necessary.
echo Example (run these with PGPASSWORD set if needed):
echo %PSQL_EXE% -h %DBHOST% -U %DBUSER% -d "%DBNAME%" -c "SELECT setval(pg_get_serial_sequence('students','id'), coalesce((SELECT max(id) FROM students),0));"
echo %PSQL_EXE% -h %DBHOST% -U %DBUSER% -d "%DBNAME%" -c "ALTER TABLE students ALTER COLUMN is_active TYPE boolean USING (is_active::int = 1);"

endlocal
exit /b 0
