import { describe, expect, it } from 'vitest';
import { abrirEnChrome, esAndroid, navegadorInterno } from './navegador';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';

describe('el navegador interno de una red social (D-116)', () => {
  it('reconoce Instagram, Facebook, Messenger y TikTok, en iPhone y en Android', () => {
    expect(navegadorInterno(`${IPHONE} Mobile/15E148 Instagram 330.0.3.12.235 (iPhone15,2; iOS 17_5)`)).toBe(
      'Instagram',
    );
    expect(
      navegadorInterno(
        'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36 Instagram 330.0.0.40.92 Android',
      ),
    ).toBe('Instagram');
    expect(navegadorInterno(`${IPHONE} Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/1]`)).toBe(
      'Facebook',
    );
    expect(navegadorInterno(`${IPHONE} Mobile/15E148 [FBAN/MessengerForiOS;FBAV/460.0]`)).toBe('Messenger');
    expect(
      navegadorInterno('Mozilla/5.0 (Linux; Android 13) ... musical_ly_2023405030 BytedanceWebview/d8a21c6'),
    ).toBe('TikTok');
  });

  it('Safari, Chrome y el navegador de WhatsApp no cuentan como internos', () => {
    expect(navegadorInterno(`${IPHONE} Version/17.5 Mobile/15E148 Safari/604.1`)).toBeNull();
    expect(
      navegadorInterno(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36',
      ),
    ).toBeNull();
    expect(navegadorInterno(null)).toBeNull();
  });

  it('en Android, abre la misma dirección en Chrome', () => {
    expect(esAndroid('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true);
    expect(esAndroid(IPHONE)).toBe(false);
    expect(abrirEnChrome('https://j-solutions-nine.vercel.app/invitacion/abc')).toBe(
      'intent://j-solutions-nine.vercel.app/invitacion/abc#Intent;scheme=https;package=com.android.chrome;end',
    );
  });
});
