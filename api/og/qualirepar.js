// /api/og/qualirepar.js — T1 QualiRépar
// Image PNG 1080x1080 · Annonce bonus QualiRépar
// Usage : /api/og/qualirepar?bonus=25&repair=Batterie&device=iPhone+12
import { ImageResponse } from '@vercel/og';
export const config = { runtime: 'edge' };

const RED = '#C8102E';
const BLACK = '#0A0A0C';

const h = (type, props, ...kids) => ({
  type, props: { ...(props || {}), children: kids.length === 0 ? undefined : kids.length === 1 ? kids[0] : kids }
});

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const bonus = searchParams.get('bonus') || '25';
  const repair = (searchParams.get('repair') || 'Batterie').toUpperCase();
  const device = (searchParams.get('device') || 'iPhone 12').toUpperCase();

  const tree = h('div', {
    style: {
      width: '1080px', height: '1080px', display: 'flex', position: 'relative',
      background: BLACK, color: '#fff', fontFamily: 'sans-serif',
    }
  },
    // RED top plane
    h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, height: '540px', background: RED, display: 'flex' } }),

    // brackets
    h('div', { style: { position: 'absolute', top: '46px', left: '46px', fontSize: '30px', fontWeight: 700, color: '#fff', display: 'flex' } }, '◢'),
    h('div', { style: { position: 'absolute', bottom: '300px', left: '46px', fontSize: '36px', fontWeight: 700, color: RED, display: 'flex' } }, '◣'),
    h('div', { style: { position: 'absolute', bottom: '46px', right: '46px', fontSize: '30px', fontWeight: 700, color: '#fff', opacity: 0.4, display: 'flex' } }, '◥'),

    // chrome top-left
    h('div', {
      style: {
        position: 'absolute', top: '60px', left: '90px', display: 'flex', alignItems: 'center', gap: '12px',
        fontSize: '14px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#fff',
      }
    },
      h('span', { style: { padding: '5px 10px', background: BLACK, color: '#fff', fontWeight: 700, display: 'flex' } }, '// CERTIFIÉ ÉTAT'),
      h('span', { style: { opacity: 0.85, display: 'flex' } }, 'QUALIRÉPAR · AUTO-DÉDUIT'),
    ),

    // chrome top-right
    h('div', {
      style: {
        position: 'absolute', top: '60px', right: '90px', display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end', fontSize: '12px', letterSpacing: '0.22em', textTransform: 'uppercase',
        color: '#fff', lineHeight: 1.6,
      }
    },
      h('div', { style: { display: 'flex' } }, 'FILE · ', h('span', { style: { fontWeight: 800, marginLeft: '6px' } }, 'QUALIREPAR')),
      h('div', { style: { display: 'flex' } }, 'OP · ', h('span', { style: { fontWeight: 800, marginLeft: '6px' } }, `BONUS.${bonus}€`)),
    ),

    // top-tick left
    h('div', {
      style: {
        position: 'absolute', left: '72px', top: '280px', display: 'flex', flexDirection: 'column',
        fontSize: '18px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#fff', lineHeight: 1.4,
      }
    },
      h('span', { style: { display: 'flex' } }, 'BONUS'),
      h('span', { style: { fontWeight: 800, color: BLACK, display: 'flex' } }, 'D\'ÉTAT'),
    ),

    // top-tick right
    h('div', {
      style: {
        position: 'absolute', right: '72px', top: '280px', display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end', fontSize: '18px', letterSpacing: '0.22em', textTransform: 'uppercase',
        color: '#fff', lineHeight: 1.4,
      }
    },
      h('span', { style: { display: 'flex' } }, 'APPLIQUÉ'),
      h('span', { style: { fontWeight: 800, color: BLACK, display: 'flex' } }, 'À CAISSE'),
    ),

    // MONSTER -bonus€ centered
    h('div', {
      style: {
        position: 'absolute', top: '90px', left: 0, right: 0, display: 'flex',
        justifyContent: 'center', alignItems: 'flex-start',
        fontSize: '480px', fontWeight: 900, lineHeight: 0.78, letterSpacing: '-0.06em',
        color: '#fff', whiteSpace: 'nowrap',
      }
    },
      h('span', { style: { color: BLACK, marginRight: '4px', display: 'flex' } }, '−'),
      h('span', { style: { display: 'flex' } }, bonus),
      h('span', { style: { fontSize: '220px', marginLeft: '8px', fontWeight: 800, lineHeight: 1, marginTop: '24px', color: BLACK, display: 'flex' } }, '€'),
    ),

    // SHOUT
    h('div', {
      style: {
        position: 'absolute', left: '72px', right: '72px', top: '640px', display: 'flex', flexDirection: 'column',
        fontSize: '110px', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.035em', color: '#fff',
      }
    },
      h('span', { style: { display: 'flex' } }, 'Votre facture.'),
      h('div', { style: { display: 'flex', marginTop: '8px' } },
        h('span', { style: { background: RED, color: '#fff', padding: '0 16px 6px', display: 'flex' } }, `Moins ${bonus} €.`),
      ),
    ),

    // device-line
    h('div', {
      style: {
        position: 'absolute', left: '72px', top: '850px', display: 'flex', alignItems: 'center', gap: '10px',
        fontSize: '18px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
      }
    },
      h('span', { style: { display: 'flex' } }, 'RÉPARATION ·'),
      h('span', { style: { color: '#fff', fontWeight: 800, display: 'flex' } }, repair),
      h('span', { style: { display: 'flex' } }, '·'),
      h('span', { style: { color: '#fff', fontWeight: 800, display: 'flex' } }, device),
    ),

    // baseline
    h('div', {
      style: {
        position: 'absolute', left: '72px', bottom: '180px', display: 'flex', alignItems: 'center', gap: '14px',
        fontSize: '14px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)',
      }
    },
      h('span', { style: { display: 'flex' } }, 'PAS D\'AVANCE'),
      h('span', { style: { width: '4px', height: '4px', background: RED, borderRadius: '50%', display: 'flex' } }),
      h('span', { style: { display: 'flex' } }, 'PAS DE PAPERASSE'),
      h('span', { style: { width: '4px', height: '4px', background: RED, borderRadius: '50%', display: 'flex' } }),
      h('span', { style: { display: 'flex' } }, 'BONUS D\'ÉTAT, POINT.'),
    ),

    // footer
    h('div', {
      style: {
        position: 'absolute', left: '72px', right: '72px', bottom: '60px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'flex-end',
        fontSize: '13px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.7,
      }
    },
      // brand
      h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#fff' } },
          h('span', { style: { color: RED, fontSize: '18px', display: 'flex' } }, '◢'),
          h('span', { style: { display: 'flex' } }, 'SOLUTION PHONE'),
        ),
        h('div', { style: { display: 'flex', marginTop: '4px' } }, '21 RUE GAMBETTA · MÂCON'),
      ),
      // kv
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
        h('div', { style: { display: 'flex' } }, 'DEVIS · ', h('span', { style: { color: '#fff', fontWeight: 800, marginLeft: '6px' } }, '30 SEC')),
        h('div', { style: { display: 'flex', marginTop: '4px' } }, 'DÈS · ', h('span', { style: { color: '#fff', fontWeight: 800, marginLeft: '6px' } }, '35 €')),
      ),
    ),
  );

  return new ImageResponse(tree, { width: 1080, height: 1080 });
}
