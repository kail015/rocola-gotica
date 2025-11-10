@echo off
echo ================================
echo   Rocola Gotica - Iniciando
echo ================================
echo.

echo [1/2] Iniciando Backend...
start "Backend" cmd /k "cd backend && npm start"
timeout /t 3 /nobreak > nul

echo [2/2] Iniciando Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ================================
echo   Servidores iniciados!
echo ================================
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Presiona cualquier tecla para salir...
pause > nul
