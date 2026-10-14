// El aviso de la suscripción en el inicio (D-080). Al dueño: a prueba, por vencer, en gracia y en solo lectura. Al
// PM, solo cuando ya no se guarda nada, para que sepa por qué y a quién avisar.
import type { MiSuscripcion } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';

export async function AvisoSuscripcion({ suscripcion, esPm }: { suscripcion: MiSuscripcion; esPm: boolean }) {
  const t = await getTranslations('suscripcion');
  const formato = await getFormatter();
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const fecha = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { day: 'numeric', month: 'long' });
  const { estado, venceEl, graciaHasta } = suscripcion;

  if (esPm)
    return estado === 'solo_lectura' ? (
      <p role="alert" className="rounded-xl bg-red-100 p-3 font-semibold text-red-900">
        {t('soloLecturaPm')}
      </p>
    ) : null;
  if (!venceEl) return null;
  if (estado === 'solo_lectura')
    return (
      <p role="alert" className="rounded-xl bg-red-100 p-3 font-semibold text-red-900">
        {t('soloLectura', { dia: fecha(venceEl) })}
      </p>
    );
  if (estado === 'gracia')
    return (
      <p role="alert" className="rounded-xl bg-red-100 p-3 font-semibold text-red-900">
        {t('gracia', { dia: fecha(venceEl), hasta: fecha(graciaHasta!) })}
      </p>
    );
  if (estado === 'por_vencer')
    return (
      <p role="status" className="rounded-xl bg-amber-100 p-3 font-semibold text-amber-900">
        {t(suscripcion.enPrueba ? 'pruebaPorVencer' : 'porVencer', { dia: fecha(venceEl) })}
      </p>
    );
  if (estado === 'prueba')
    return (
      <p role="status" className="rounded-xl bg-sky-50 p-3 text-sky-900">
        {t('prueba', { dia: fecha(venceEl) })}
      </p>
    );
  return null;
}
