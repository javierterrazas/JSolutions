import { datosParaObraNueva, presupuestoParaCapturar } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco } from '../../../componentes/marco';
import { AgregarEspacio } from './agregar-espacio';
import { FormularioPresupuesto } from './formulario-presupuesto';

export default async function Presupuesto({ params }: PageProps<'/obras/[id]/presupuesto'>) {
  const { id } = await params;
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => presupuestoParaCapturar(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const p = r.datos;
  const catalogo = await comoMiembro((tx) => datosParaObraNueva(tx), acceso);
  const [t, to, idioma] = await Promise.all([
    getTranslations('presupuesto'),
    getTranslations('obras'),
    getLocale(),
  ]);
  return (
    <Marco
      titulo={t('titulo', { folio: p.obra.folio })}
      subtitulo={to('encabezado', { folio: p.obra.folio, cliente: p.obra.cliente })}
      volver={{ href: '/obras', texto: t('volver') }}
    >
      <p className="text-sm text-slate-600">{to(`estado.${p.obra.estado}`)}</p>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      <FormularioPresupuesto
        obraId={p.obra.id}
        espacios={p.espacios.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          pies2: e.pies2,
          piesLineales: e.piesLineales,
          etapas: e.etapas.map((x) => ({
            etapaId: x.etapaId,
            unidad: x.unidad,
            nombre: x.nombre ? ((idioma === 'en' ? x.nombre.en : null) ?? x.nombre.es) : null,
            partidas: x.partidas,
            monto: x.monto,
            costo: x.costo,
          })),
        }))}
        margenObjetivo={p.margenObjetivo}
        contrato={p.contrato}
      />
      {p.obra.estado !== 'entregada' && catalogo.ok ? (
        // se vuelve a montar al agregar uno, para quedar cerrado otra vez
        <AgregarEspacio
          key={p.espacios.length}
          obraId={p.obra.id}
          tipos={catalogo.datos.tipos.map((x) => ({
            id: x.id,
            nombre: (idioma === 'en' ? x.nombre.en : null) ?? x.nombre.es,
            partidas: x.partidas,
          }))}
        />
      ) : null}
    </Marco>
  );
}
