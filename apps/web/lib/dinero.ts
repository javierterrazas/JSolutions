// El dinero se muestra como en Estados Unidos ("$28,500.50") en los dos idiomas: el español genérico de Intl lo
// escribe como en España ("28.500,50 US$"), que no es como se lee en una obra de Texas.

export function formatoDinero(idioma: string): Intl.NumberFormat {
  return new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-US', { style: 'currency', currency: 'USD' });
}
