'use client';
// Un error de negocio, traducido por su código (D-015). Un código sin texto se muestra como "algo falló".
import { useFormatter, useTranslations } from 'next-intl';
import { estilos } from './marco';

export interface Problema {
  readonly codigo: string;
  readonly datos?: Readonly<Record<string, unknown>>;
}

export function MensajeError({ problema }: { problema: Problema | null }) {
  const t = useTranslations('errores');
  const formato = useFormatter();
  if (!problema) return null;
  const { codigo, datos } = problema;
  let texto: string;
  if (codigo === 'pin_incorrecto') {
    // como el legacy: cuántos intentos quedan, solo cuando quedan pocos
    const quedan = Number(datos?.quedan);
    texto = t('pin_incorrecto') + (quedan > 0 && quedan <= 2 ? ` ${t('pin_quedan', { quedan })}` : '');
  } else if (codigo === 'pin_bloqueado') {
    texto = t('pin_bloqueado', {
      hora: formato.dateTime(new Date(String(datos?.hasta)), { hour: 'numeric', minute: '2-digit' }),
    });
  } else if (codigo === 'pin_invalido') {
    texto = t('pin_invalido', { largo: Number(datos?.largo) });
  } else if (codigo === 'faltan') {
    const campos = (datos?.campos ?? []) as string[];
    texto = t('faltan', {
      campos: campos.map((c) => (t.has(`campos.${c}` as never) ? t(`campos.${c}` as never) : c)).join(', '),
    });
  } else if (codigo === 'faltan_pies2') {
    texto = t('faltan_pies2', { espacios: ((datos?.espacios ?? []) as string[]).join(', ') });
  } else if (codigo === 'prueba_incompleta') {
    texto = t('prueba_incompleta', { horas: Number(datos?.horas) });
  } else if (codigo === 'campos') {
    texto = t('desconocido');
  } else {
    texto = t.has(codigo as never) ? t(codigo as never) : t('desconocido');
  }
  return (
    <p role="alert" className={estilos.error}>
      {texto}
    </p>
  );
}
