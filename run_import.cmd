@echo off
REM Simple import script for Windows Command Prompt
REM Edit variables below if needed.

SET "SQLPATH=C:\Users\icile\OneDrive\Desktop\SMS\compostela_sms_postgresql_converted.sql"
SET "DBHOST=127.0.0.1"
SET "DBUSER=pg_user"
SET "DBNAME=compostela-sms"

echo Importing %SQLPATH% into %DBUSER%@%DBHOST%/%DBNAME%

REM If you want to avoid an interactive password prompt, set PGPASSWORD in this session:
REM   set PGPASSWORD=your_pg_password

where psql >nul 2>&1
if errorlevel 1 (
  echo psql not found on PATH. If PostgreSQL is installed, add its \bin to PATH or set PSQL_EXE to the full path.
  echo Example: set PSQL_EXE="C:\Program Files\PostgreSQL\14\bin\psql.exe"
  set "PSQL_EXE=psql"
) else (
  set "PSQL_EXE=psql"
)

%PSQL_EXE% -h %DBHOST% -U %DBUSER% -d "%DBNAME%" -f "%SQLPATH%"

if errorlevel 1 (
  echo Import finished with errors. Check the psql output above.
) else (
  echo Import finished successfully.
)

echo Next: reset sequences and convert tinyint flags to boolean if needed.
echo Example commands (run these in the Command Prompt with PGPASSWORD set):
echo.
echo set PGPASSWORD=your_pg_password
echo psql -h %DBHOST% -U %DBUSER% -d "%DBNAME%" -c "SELECT setval(pg_get_serial_sequence('students','id'), coalesce((SELECT max(id) FROM students),0));"
echo psql -h %DBHOST% -U %DBUSER% -d "%DBNAME%" -c "ALTER TABLE students ALTER COLUMN is_active TYPE boolean USING (is_active::int = 1);"
echo set PGPASSWORD=
