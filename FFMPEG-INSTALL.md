# Instalación de FFmpeg para Conversión Automática de Videos

## ¿Por qué FFmpeg?

FFmpeg permite convertir automáticamente videos subidos por los clientes al formato H.264/AAC, compatible con todos los navegadores web. Esto elimina la necesidad de que los usuarios conviertan manualmente sus videos.

## Instalación

### Windows

1. **Descargar FFmpeg:**
   - Ir a https://www.gyan.dev/ffmpeg/builds/
   - Descargar "ffmpeg-release-essentials.zip"
   - Extraer el ZIP en `C:\ffmpeg`

2. **Agregar al PATH:**
   - Buscar "Variables de entorno" en Windows
   - En "Variables del sistema", buscar "Path"
   - Hacer clic en "Editar"
   - Agregar nueva entrada: `C:\ffmpeg\bin`
   - Hacer clic en "Aceptar"

3. **Verificar instalación:**
   ```bash
   ffmpeg -version
   ```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg
```

### macOS

```bash
brew install ffmpeg
```

## Verificación

Después de instalar, reinicie el servidor. Debería ver el mensaje:

```
✅ FFmpeg disponible - Conversión automática de videos habilitada
```

## Sin FFmpeg

Si no instala FFmpeg, los usuarios deberán subir videos en formato MP4 (H.264) compatible. El sistema continuará funcionando pero mostrará:

```
⚠️ FFmpeg no está disponible. La conversión automática de videos estará deshabilitada.
```

## Formatos Aceptados con FFmpeg

Con FFmpeg instalado, el sistema acepta cualquier formato de video y lo convierte automáticamente:
- MP4 (cualquier codec)
- AVI
- MOV
- MKV
- WMV
- FLV
- Y muchos más...

## Conversión Automática

El proceso de conversión:
1. Usuario sube video en cualquier formato
2. Servidor convierte a MP4 (H.264 + AAC)
3. Video original se elimina
4. Video convertido queda listo para aprobación
5. Reproducción garantizada en todos los navegadores
