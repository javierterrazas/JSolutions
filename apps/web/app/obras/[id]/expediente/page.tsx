// El expediente de una obra (D-102; lo pidió el dueño): todo lo de la obra en un documento para guardar como PDF. Se
// eligen las secciones y "Descargar PDF" abre la opción de imprimir del teléfono o la computadora (Guardar como PDF).
// Lleva dinero: solo el dueño o el administrador.
import {
  albumDeObra,
  calidadDeLaObra,
  cambiosDeObra,
  cobrosDeObra,
  posventaDeObra,
  type RegistroDelAlbum,
  retrabajosDeObra,
  revisionDeCierre,
  seguimientoDeObra,
  subcontratosDeObra,
} from '@ijm/servidor';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDuenoCon } from '@/lib/acceso';
import { rutasDeMarca } from '../../../marca/datos';
import { Expediente } from './expediente';

/** Hasta cuántas páginas del álbum (de 20 registros) entran al expediente. */
const PAGINAS_DE_FOTOS = 15;

export default async function ExpedienteDeObra({ params }: PageProps<'/obras/[id]/expediente'>) {
  const { id } = await params;
  const acceso = await exigirDuenoCon('posventa');
  const r = await comoMiembro(async (tx) => {
    const seguimiento = await seguimientoDeObra(tx, { obraId: id, todos: true });
    if (!seguimiento) return null;
    const fotos: RegistroDelAlbum[] = [];
    for (let pagina = 0; pagina < PAGINAS_DE_FOTOS; pagina++) {
      const a = await albumDeObra(tx, { obraId: id, pagina });
      fotos.push(...(a?.registros ?? []));
      if (!a?.hayMas) break;
    }
    return {
      seguimiento,
      cierre: await revisionDeCierre(tx, { obraId: id }),
      cambios: await cambiosDeObra(tx, { obraId: id }),
      cobros: await cobrosDeObra(tx, { obraId: id }),
      subcontratos: await subcontratosDeObra(tx, { obraId: id }),
      calidad: await calidadDeLaObra(tx, { obraId: id }),
      retrabajos: await retrabajosDeObra(tx, { obraId: id }),
      posventa: await posventaDeObra(tx, { obraId: id }),
      fotos,
    };
  }, acceso);
  if (!r.ok || !r.datos) notFound();
  const { yo } = acceso;
  return (
    <Expediente
      empresa={{
        nombre: yo.empresa,
        logo: yo.marca.conLogo ? rutasDeMarca(yo.empresaId, yo.marca.version).logo : null,
      }}
      datos={r.datos}
    />
  );
}
