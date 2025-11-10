@echo off
echo ========================================
echo  VERIFICACION PRE-DEPLOY
echo  Rocola Gotica
echo ========================================
echo.

echo [1/5] Verificando estructura de archivos...
if exist "backend\server.js" (
    echo ✓ Backend encontrado
) else (
    echo ✗ Backend NO encontrado
    goto :error
)

if exist "frontend\package.json" (
    echo ✓ Frontend encontrado
) else (
    echo ✗ Frontend NO encontrado
    goto :error
)

if exist "netlify.toml" (
    echo ✓ Configuracion Netlify encontrada
) else (
    echo ✗ netlify.toml NO encontrado
    goto :error
)

echo.
echo [2/5] Verificando dependencias del backend...
cd backend
call npm list express socket.io cors >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Dependencias del backend OK
) else (
    echo ! Instalando dependencias del backend...
    call npm install
)
cd ..

echo.
echo [3/5] Verificando dependencias del frontend...
cd frontend
call npm list react socket.io-client >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Dependencias del frontend OK
) else (
    echo ! Instalando dependencias del frontend...
    call npm install
)
cd ..

echo.
echo [4/5] Verificando archivo .env...
if exist "backend\.env" (
    echo ✓ Archivo .env encontrado
    findstr "YOUTUBE_API_KEY" backend\.env >nul
    if %errorlevel% equ 0 (
        echo ✓ YouTube API Key configurada
    ) else (
        echo ✗ YouTube API Key NO configurada en .env
        goto :error
    )
) else (
    echo ! Creando archivo .env de ejemplo...
    echo PORT=3001 > backend\.env
    echo YOUTUBE_API_KEY=TU_API_KEY_AQUI >> backend\.env
    echo ⚠ EDITA backend\.env y agrega tu YouTube API Key
    goto :error
)

echo.
echo [5/5] Verificando Git...
git --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Git instalado
    if exist ".git" (
        echo ✓ Repositorio Git inicializado
    ) else (
        echo ! Repositorio Git NO inicializado
        echo   Ejecuta: git init
    )
) else (
    echo ✗ Git NO instalado
    echo   Descarga desde: https://git-scm.com/
    goto :error
)

echo.
echo ========================================
echo  ✓ VERIFICACION COMPLETA
echo ========================================
echo.
echo Tu proyecto está listo para deploy!
echo.
echo Proximos pasos:
echo 1. Lee NETLIFY-DEPLOY.md para instrucciones
echo 2. Sube codigo a GitHub
echo 3. Deploy backend en Render
echo 4. Deploy frontend en Netlify
echo.
goto :end

:error
echo.
echo ========================================
echo  ✗ VERIFICACION FALLIDA
echo ========================================
echo.
echo Corrige los errores arriba y vuelve a ejecutar.
echo.

:end
pause
