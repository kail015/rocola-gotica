# 📹 Instrucciones para agregar el video de intro

## Paso 1: Preparar el video
1. Ve a la carpeta: `C:\Users\kail0\Downloads\`
2. Localiza el archivo: `logo animado .mp4`
3. Renómbralo a: `intro.mp4` (sin espacios)

## Paso 2: Copiar el video al proyecto
Copia el archivo `intro.mp4` a la carpeta:
```
D:\rocola gotica\frontend\public\
```

## Paso 3: Verificar
La ruta final debe ser:
```
D:\rocola gotica\frontend\public\intro.mp4
```

## Paso 4: Hacer commit
Después de copiar el video, ejecuta:
```bash
cd "D:\rocola gotica"
git add .
git commit -m "📹 Add intro video"
git push origin main
```

## ✅ Listo
Una vez deployado, el video se reproducirá automáticamente al abrir la aplicación.

### Características implementadas:
- ✅ Video se reproduce automáticamente al abrir la app
- ✅ Se puede saltar con botón "Saltar intro →"
- ✅ Después del video, aparece el modal de nombre de usuario
- ✅ Pantalla completa en negro con el video centrado
- ✅ Funciona en móvil y desktop
