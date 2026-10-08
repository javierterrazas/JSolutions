import { presupuestoParaCapturar } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco } from '../../../componentes/marco';
import { FormularioPresupuesto } from './formulario-presupuesto';

export default async function Presupuesto({ params }: PageProps<'/obras/[id]/presupuesto'>) {
  const { id } = await params;
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => presupuestoParaCapturar(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const p = r.datos;
  const [t, to, idioma] = await Promise.all([
    getTranslations('presupuesto'),
    getTranslations('obras'),
    getLocale(),
  ]);
  return (
    <Marco titulo={t('titulo', { folio: p.obra.folio })}>
      <Link href="/obras" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-slate-700">
        {to('encabezado', { folio: p.obra.folio, cliente: p.obra.cliente })}
        <br />
        <span className="text-sm text-slate-600">{to(`estado.${p.obra.estado}`)}</span>
      </p>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      <FormularioPresupuesto
        obraId={p.obra.id}
        espacios={p.espacios.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          etapas: e.etapas.map((x) => ({
            etapaId: x.etapaId,
            nombre: x.nombre ? ((idioma === 'en' ? x.nombre.en : null) ?? x.nombre.es) : null,
            partidas: x.partidas,
            monto: x.monto,
          })),
        }))}
      />
    </Marco>
  );
}
