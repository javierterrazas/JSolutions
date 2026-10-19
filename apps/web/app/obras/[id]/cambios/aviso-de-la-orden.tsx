// El aviso del PM del que sale una orden de cambio (D-103): qué escribió, cuándo y sus fotos, para describirle bien la
// orden al cliente.
import { useFormatter, useTranslations } from 'next-intl';

export function AvisoDeLaOrden({
  aviso,
}: {
  aviso: {
    folio: string;
    tipo: string;
    descripcion: string;
    dia: string;
    pm: string | null;
    fotos: readonly string[];
  };
}) {
  const t = useTranslations('cambios');
  const ta = useTranslations('aviso');
  const formato = useFormatter();
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-800">
        {t('delAviso', {
          folio: aviso.folio,
          tipo: ta.has(`tipos.${aviso.tipo}` as never) ? ta(`tipos.${aviso.tipo}` as never) : aviso.tipo,
          pm: aviso.pm ?? '—',
          dia: formato.dateTime(new Date(`${aviso.dia}T12:00:00`), { dateStyle: 'medium' }),
        })}
      </p>
      <p className="whitespace-pre-line text-slate-700">{aviso.descripcion}</p>
      {aviso.fotos.length ? (
        <ul className="grid grid-cols-4 gap-2">
          {aviso.fotos.map((f) => (
            <li key={f}>
              <a href={`/fotos/${f}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- un enlace firmado de pocos minutos, no se optimiza */}
                <img
                  src={`/fotos/${f}`}
                  alt=""
                  className="aspect-square w-full rounded-lg bg-slate-100 object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
