// Los retrabajos y las garantías de una obra, para el dueño (D-090; legacy: duNoCalidad y duGarantia): un error propio
// que se paga (nace cerrado, con su costo y los días que se perdieron) o un reclamo del cliente después de la entrega
// (abierto hasta que se atiende). De aquí salen el costo de no calidad y las garantías de los indicadores.
import { retrabajosDeObra } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDuenoCon } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../../../componentes/marco';
import { CerrarGarantia } from './cerrar-garantia';
import { FormularioNoCalidad } from './formulario-no-calidad';

export default async function Retrabajos({ params }: PageProps<'/obras/[id]/retrabajos'>) {
  const { id } = await params;
  const acceso = await exigirDuenoCon('posventa');
  const r = await comoMiembro((tx) => retrabajosDeObra(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, to, idioma, formato] = await Promise.all([
    getTranslations('retrabajos'),
    getTranslations('obras'),
    getLocale(),
    getFormatter(),
  ]);
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const total = d.registros.reduce((s, x) => s + x.costo, 0);

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={to('encabezado', { folio: d.obra.folio, cliente: d.obra.cliente })}
      volver={{ href: `/obras/${d.obra.id}/seguimiento`, texto: t('volver') }}
    >
      <p className="text-slate-700">{t('intro')}</p>
      <FormularioNoCalidad obraId={d.obra.id} entregada={d.obra.entregada} subs={d.subs} />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-marca">
          {t('registrados', { n: d.registros.length, total: dinero(total) })}
        </h2>
        {d.registros.length ? (
          <ul className="flex flex-col gap-2">
            {d.registros.map((x) => (
              <li
                key={x.id}
                className={`${estilos.tarjeta} flex flex-col gap-1 text-sm ${x.abierto ? 'border-amber-400' : ''}`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">
                    {t('encabezadoRegistro', { folio: x.folio, tipo: t(`tipos.${x.tipo}`) })}
                  </span>
                  <span className="font-semibold">{dinero(x.costo)}</span>
                </div>
                <p className="whitespace-pre-line text-slate-800">{x.descripcion}</p>
                <p className="text-slate-600">
                  {[
                    formato.dateTime(x.creado, { dateStyle: 'medium' }),
                    x.causa ? t(`causas.${x.causa}`) : null,
                    x.sub,
                    x.diasPerdidos ? t('diasPerdidos', { n: x.diasPerdidos }) : null,
                  ]
                    .filter(Boolean)
                    .join(t('separador'))}
                </p>
                {x.abierto ? (
                  <CerrarGarantia obraId={d.obra.id} noCalidadId={x.id} />
                ) : x.tipo === 'garantia' && x.cerrado ? (
                  <p className="text-emerald-800">
                    {t('atendida', { dia: formato.dateTime(x.cerrado, { dateStyle: 'medium' }) })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">{t('ninguno')}</p>
        )}
      </section>
    </Marco>
  );
}
