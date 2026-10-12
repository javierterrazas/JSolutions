'use client';
// Pegar la invitación dentro de la app instalada (D-057): en el iPhone no comparte las cookies de Safari, así que
// abrir el enlace desde WhatsApp verifica Safari y no la app. Desde aquí se abre dentro de ella.
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { tokenDeInvitacion } from '@/lib/invitacion';
import { estilos } from '../componentes/marco';

export function PegarInvitacion() {
  const t = useTranslations('sinAcceso');
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [noSirve, setNoSirve] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const token = tokenDeInvitacion(texto);
        setNoSirve(!token);
        if (token) router.push(`/invitacion/${token}`);
      }}
      className={`${estilos.tarjeta} flex flex-col gap-3`}
    >
      <label className={estilos.etiqueta}>
        {t('pegar')}
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t('pegarEjemplo')}
          autoComplete="off"
          className={estilos.campo}
        />
      </label>
      {noSirve ? (
        <p role="alert" className={estilos.error}>
          {t('noEsInvitacion')}
        </p>
      ) : null}
      <button type="submit" className={estilos.boton}>
        {t('abrirInvitacion')}
      </button>
    </form>
  );
}
