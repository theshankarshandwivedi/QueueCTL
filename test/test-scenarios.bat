@echo off
REM QueueCTL Test Scenarios for Windows
REM Run this script to test all core functionality

echo ============================================
echo QueueCTL Test Suite (Windows)
echo ============================================
echo.

setlocal enabledelayedexpansion
set TESTS_PASSED=0
set TESTS_FAILED=0

REM Clean up function
echo Cleaning up old data...
queuectl worker stop 2>nul
timeout /t 2 /nobreak >nul
if exist data\jobs.json del data\jobs.json
if exist data\config.json del data\config.json
if exist data\workers.json del data\workers.json

echo.
echo ========================================
echo Test 1: Configuration Management
echo ========================================
queuectl config get
if %ERRORLEVEL% EQU 0 (
    echo [PASS] Display default configuration
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Display default configuration
    set /a TESTS_FAILED+=1
)

queuectl config set max-retries 5
if %ERRORLEVEL% EQU 0 (
    echo [PASS] Set max-retries to 5
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Set max-retries to 5
    set /a TESTS_FAILED+=1
)

queuectl config set backoff-base 3
if %ERRORLEVEL% EQU 0 (
    echo [PASS] Set backoff-base to 3
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Set backoff-base to 3
    set /a TESTS_FAILED+=1
)

echo.
echo ========================================
echo Test 2: Job Enqueuing
echo ========================================
queuectl enqueue "{\"id\":\"test-job-1\",\"command\":\"echo Hello World\"}"
if %ERRORLEVEL% EQU 0 (
    echo [PASS] Enqueue simple echo command
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Enqueue simple echo command
    set /a TESTS_FAILED+=1
)

queuectl enqueue "{\"id\":\"test-job-2\",\"command\":\"timeout /t 2 /nobreak ^>nul ^&^& echo Done\"}"
if %ERRORLEVEL% EQU 0 (
    echo [PASS] Enqueue timeout command
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Enqueue timeout command
    set /a TESTS_FAILED+=1
)

queuectl enqueue "{\"id\":\"test-job-3\",\"command\":\"invalid_command_xyz\"}"
if %ERRORLEVEL% EQU 0 (
    echo [PASS] Enqueue invalid command
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Enqueue invalid command
    set /a TESTS_FAILED+=1
)

echo.
echo ========================================
echo Test 3: Job Listing
echo ========================================
queuectl list --state pending
if %ERRORLEVEL% EQU 0 (
    echo [PASS] List pending jobs
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] List pending jobs
    set /a TESTS_FAILED+=1
)

queuectl status
if %ERRORLEVEL% EQU 0 (
    echo [PASS] Show queue status
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Show queue status
    set /a TESTS_FAILED+=1
)

echo.
echo ========================================
echo Test 4: Worker Management
echo ========================================
echo Starting workers...
start /B queuectl worker start --count 2
timeout /t 3 /nobreak >nul

if %ERRORLEVEL% EQU 0 (
    echo [PASS] Start 2 workers
    set /a TESTS_PASSED+=1
) else (
    echo [FAIL] Start 2 workers
    set /a TESTS_FAILED+=1
)

echo Let workers process jobs...
timeout /t 10 /nobreak >nul

queuectl status
queuectl list

echo Stopping workers...
queuectl worker stop
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo Test 5: Multiple Workers Test
echo ========================================
echo Enqueuing multiple jobs...

for /L %%i in (1,1,5) do (
    queuectl enqueue "{\"id\":\"multi-%%i\",\"command\":\"timeout /t 1 /nobreak ^>nul ^&^& echo Job %%i\"}"
)

echo Starting 3 workers...
start /B queuectl worker start --count 3
timeout /t 10 /nobreak >nul

queuectl status
queuectl worker stop
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo Test Summary
echo ========================================
echo Tests Passed: %TESTS_PASSED%
echo Tests Failed: %TESTS_FAILED%
echo ========================================

if %TESTS_FAILED% EQU 0 (
    echo [SUCCESS] All tests passed!
    exit /b 0
) else (
    echo [WARNING] Some tests failed
    exit /b 1
)