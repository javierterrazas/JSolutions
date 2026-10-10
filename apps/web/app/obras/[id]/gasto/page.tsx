// Los gastos de una obra, para su PM (fase 2, paso 6b; legacy: vGasto de PM.html): registrar uno, adjuntar el
// recibo de los que no lo tienen, y corregir o anular lo que capturó en las últimas 48 horas.
import { datosParaGasto } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco } from '../../../componentes/marco';
import { FormularioGasto } from './formulario-gasto';
import { GastoCapturado } from './gasto-capturado';

export default async function Gasto({ params }: PageProps<'/obras/[id]/gasto'>) {
  const { id } = await params;
  const acceso = await exigirAcceso();
  if (acceso.yo.rol !== 'pm') redirect('/');
  const r = await comoMiembro((tx) => datosParaGasto(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, idioma] = await Promise.all([getTranslations('gasto'), getLocale()]);
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  const espacios = d.espacios.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    partidas: e.partidas.map((p) => ({ id: p.id, nombre: nombre(p.nombre), enCurso: p.enCurso })),
  }));
  // los que no tienen recibo primero; un gasto reciente sin recibo sale una sola vez
  const lista = [...d.sinRecibo, ...d.recientes.filter((g) => g.conRecibo)];

  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-slate-700">{t('obra', { folio: d.obra.folio, cliente: d.obra.cliente })}</p>
      <FormularioGasto datos={{ obraId: d.obra.id, folio: d.obra.folio, limite: d.limite, espacios }} />
      {lista.length ? (
        <section className="mt-4 flex flex-col gap-3">
          <h2 className="text-lg font-bold text-marca">{t('tusGastos')}</h2>
          <p className="text-sm text-slate-600">{t('tusGastosAyuda')}</p>
          <ul className="flex flex-col gap-3">
            {lista.map((g) => (
              <GastoCapturado key={g.id} obraId={d.obra.id} gasto={g} espacios={espacios} />
            ))}
          </ul>
        </section>
      ) : null}
    </Marco>
  );
}
