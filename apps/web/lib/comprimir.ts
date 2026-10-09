// Las fotos se comprimen en el teléfono antes de subirse (plan de la fase 2, paso 4): una foto de celular pesa de 3 a
// 8 MB, y en obra la señal es mala. A 1600 px por lado y JPEG al 75 % queda en unos cientos de KB y se sigue viendo
// bien la obra. Las fotos HEIC del iPhone salen como JPEG.

/** El tamaño final: el lado más largo a lo más `lado`; nunca se agranda. */
export function medidas(ancho: number, alto: number, lado = 1600): { ancho: number; alto: number } {
  const escala = Math.min(1, lado / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) };
}

export async function comprimirFoto(archivo: Blob, lado = 1600, calidad = 0.75): Promise<Blob> {
  // createImageBitmap respeta la orientación de la cámara (EXIF)
  const imagen = await createImageBitmap(archivo);
  const m = medidas(imagen.width, imagen.height, lado);
  const lienzo = document.createElement('canvas');
  lienzo.width = m.ancho;
  lienzo.height = m.alto;
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, m.ancho, m.alto);
  imagen.close();
  return new Promise((listo, falla) =>
    lienzo.toBlob(
      (b) => (b ? listo(b) : falla(new Error('No se pudo comprimir la foto'))),
      'image/jpeg',
      calidad,
    ),
  );
}
