// Registrar una compra de la oficina en una obra (D-063): el dueño o el administrador, con su recibo si lo tiene. Cuenta
// en el presupuesto de la obra y en su día a día; el PM nunca la ve. Abajo, las compras de la obra (de la oficina y del
// PM) para corregirlas o anularlas con su motivo (D-068).
import { datosParaCompra } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../../../componentes/marco';
import { GastoCapturado } from '../gasto/gasto-capturado';
import { FormularioCompra } from './formulario-compra';

export default async function Compra({ params }: PageProps<'/obras/[id]/compra'>) {
  const { id } = await params;
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => datosParaCompra(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, idioma] = await Promise.all([getTranslations('compra'), getLocale()]);
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  const espacios = d.espacios.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    partidas: e.partidas.map((p) => ({ id: p.id, nombre: nombre(p.nombre), enCurso: false })),
  }));

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={t('obra', { folio: d.obra.folio, cliente: d.obra.cliente })}
      volver={{ href: `/obras/${d.obra.id}/seguimiento`, texto: t('volver') }}
    >
      {d.cerrada ? (
        <p className={estilos.tarjeta}>{t('cerrada')}</p>
      ) : (
        <FormularioCompra obraId={d.obra.id} hoy={d.hoy} espacios={espacios} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-marca">{t('compras')}</h2>
        <p className="text-sm text-slate-700">{t('comprasAyuda')}</p>
        {d.compras.length === 0 ? <p className={estilos.tarjeta}>{t('sinCompras')}</p> : null}
        <ul className="flex flex-col gap-3">
          {d.compras.map((g) => (
            <GastoCapturado key={g.id} obraId={d.obra.id} gasto={g} espacios={espacios} dueno />
          ))}
        </ul>
      </section>
    </Marco>
  );
}
