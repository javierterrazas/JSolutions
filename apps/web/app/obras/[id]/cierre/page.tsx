// Cerrar el día de una obra (fase 2, paso 4). Solo el PM de la obra. Con ?dia=AAAA-MM-DD, uno de los días que le
// faltó cerrar (los últimos 2 laborables); la regla la revisa cerrarDia al guardar. Si el día ya está cerrado y el
// PM todavía lo puede corregir (48 h), ofrece corregirlo; con ?corregir=1, el formulario viene lleno con lo que se
// capturó (D-044).
import { cierreParaCorregir, datosParaCierre } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco, estilos } from '../../../componentes/marco';
import { FormularioCierre } from './formulario-cierre';

export default async function Cierre({ params, searchParams }: PageProps<'/obras/[id]/cierre'>) {
  const { id } = await params;
  const consulta = await searchParams;
  const diaPedido = typeof consulta.dia === 'string' ? consulta.dia : null;
  const acceso = await exigirAcceso();
  if (acceso.yo.rol !== 'pm') redirect('/');

  const primero = await comoMiembro((tx) => datosParaCierre(tx, { obraId: id, dia: diaPedido }), acceso);
  if (!primero.ok || !primero.datos) notFound();
  const cerrado = primero.datos.yaCerrado
    ? await comoMiembro((tx) => cierreParaCorregir(tx, { obraId: id, dia: primero.datos!.dia }), acceso)
    : null;
  const anterior = cerrado?.ok ? cerrado.datos : null;
  const corrigiendo = !!anterior?.corregible && consulta.corregir === '1';
  // corrigiendo, lo que registró ese cierre se ofrece otra vez (sus partidas terminadas, sus subs)
  const r = corrigiendo
    ? await comoMiembro(
        (tx) => datosParaCierre(tx, { obraId: id, dia: diaPedido, corrige: anterior!.bitacoraId }),
        acceso,
      )
    : primero;
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;

  const [t, formato, idioma] = await Promise.all([getTranslations('cierre'), getFormatter(), getLocale()]);
  const nombreDia = formato.dateTime(new Date(`${d.dia}T12:00:00`), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const enlaceCorregir = `/obras/${id}/cierre?${new URLSearchParams({ ...(diaPedido ? { dia: diaPedido } : {}), corregir: '1' })}`;

  return (
    <Marco
      titulo={
        corrigiendo
          ? t('tituloCorregir', { dia: nombreDia })
          : d.tardio
            ? t('tituloTardio', { dia: nombreDia })
            : t('titulo')
      }
    >
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-slate-700">{t('obra', { folio: d.obra.folio, cliente: d.obra.cliente })}</p>
      {d.yaCerrado && !corrigiendo ? (
        <div className={`${estilos.tarjeta} flex flex-col gap-3`}>
          <p role="status">{t('yaCerrado')}</p>
          {anterior?.corregible ? (
            <Link href={enlaceCorregir} className={`${estilos.boton} flex items-center justify-center`}>
              {t('corregir')}
            </Link>
          ) : anterior ? (
            <p className="text-sm text-slate-600">{t('yaNoSeCorrige')}</p>
          ) : null}
        </div>
      ) : (
        <FormularioCierre
          datos={{
            obraId: d.obra.id,
            folio: d.obra.folio,
            dia: d.dia,
            tardio: d.tardio,
            espacios: d.espacios.map((e) => ({
              id: e.id,
              nombre: e.nombre,
              partidas: e.partidas.map((p) => ({
                id: p.id,
                nombre: (idioma === 'en' ? p.nombre.en : null) ?? p.nombre.es,
                enCurso: p.estado === 'en_progreso',
                hito: p.hito,
                faltaInspeccion: p.faltaInspeccion,
              })),
            })),
            trabajadores: d.trabajadores,
            subs: d.subs.map((s) => ({ ordenId: s.ordenId, sub: s.sub, alcance: s.alcance })),
            motivos: d.motivos,
          }}
          correccion={corrigiendo ? anterior : null}
        />
      )}
    </Marco>
  );
}
