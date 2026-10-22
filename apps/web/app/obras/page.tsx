// Las obras de la empresa, para el dueño: cada una con su estado y, de un vistazo, cuánto lleva, cuánto del
// presupuesto ha gastado y si va tarde (D-062). Tocarla abre su seguimiento. Se filtran por estado, búsqueda,
// periodo y PM (D-100, en ListaObras).
import { obrasDeLaEmpresa, resumenDeObras } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Suspense } from 'react';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { ListaObras } from './lista-obras';

export default async function Obras() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => obrasDeLaEmpresa(tx), acceso);
  const resumen = await comoMiembro((tx) => resumenDeObras(tx), acceso);
  const [t, ti] = await Promise.all([getTranslations('obras'), getTranslations('inicio')]);
  return (
    <Marco titulo={t('titulo')} volver={{ href: '/', texto: ti('hola', { nombre: acceso.yo.nombre }) }} ancho>
      <Link
        href="/obras/nueva"
        className={`${estilos.boton} flex items-center justify-center lg:self-start lg:px-10`}
      >
        {t('nueva')}
      </Link>
      {r.ok ? (
        <Suspense>
          <ListaObras
            hoy={r.datos.hoy}
            obras={r.datos.obras.map((o) => ({
              ...o,
              resumen: (resumen.ok ? resumen.datos.get(o.id) : undefined) ?? null,
            }))}
          />
        </Suspense>
      ) : (
        <MensajeError problema={r} />
      )}
    </Marco>
  );
}
