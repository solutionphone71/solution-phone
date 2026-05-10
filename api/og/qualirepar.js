// /api/og/qualirepar.js
// Génère une image PNG 1080x1080 pour annoncer un bonus QualiRépar
//
// Usage : /api/og/qualirepar?bonus=25&repair=Batterie&device=iPhone+12
//
// Reproduction fidèle du template T1 de Claude Design

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const RED = '#e30613';
const BLACK = '#0A0A0C';

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const bonus = searchParams.get('bonus') || '25';
  const repair = searchParams.get('repair') || 'Batterie';
  const device = searchParams.get('device') || 'iPhone 12';
  const claimId = searchParams.get('claim_id') || '';

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '1080px', height: '1080px',
          display: 'flex', flexDirection: 'column',
          background: BLACK, color: '#fff',
          fontFamily: 'Inter',
          position: 'relative',
        },
        children: [
          // RED TOP PLANE (haut, 540px)
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', top: 0, left: 0, right: 0, height: '540px',
                background: RED, display: 'flex', flexDirection: 'column',
                padding: '72px',
              },
              children: [
                // Top label "◢ SOLUTION PHONE"
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex', alignItems: 'center', gap: '14px',
                      fontSize: '24px', fontWeight: 800, letterSpacing: '0.18em',
                      textTransform: 'uppercase', color: '#fff',
                    },
                    children: [
                      { type: 'span', props: { style: { fontSize: '32px', color: '#fff' }, children: '◢' } },
                      'Solution Phone',
                      { type: 'span', props: { style: { opacity: 0.7 }, children: '· Mâcon' } },
                    ],
                  },
                },
                // Bonus label
                {
                  type: 'div',
                  props: {
                    style: {
                      marginTop: '60px',
                      fontSize: '28px', fontWeight: 700, letterSpacing: '0.22em',
                      textTransform: 'uppercase', color: '#fff', opacity: 0.85,
                    },
                    children: 'Bonus QualiRépar',
                  },
                },
                // BIG NUMBER
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex', alignItems: 'flex-start',
                      marginTop: '18px',
                      fontSize: '320px', fontWeight: 900, lineHeight: 0.9,
                      letterSpacing: '-0.05em', color: '#fff',
                    },
                    children: [
                      bonus,
                      { type: 'span', props: { style: { fontSize: '160px', marginLeft: '12px', marginTop: '24px', fontWeight: 800 }, children: '€' } },
                    ],
                  },
                },
                // Subtext
                {
                  type: 'div',
                  props: {
                    style: {
                      marginTop: '16px',
                      fontSize: '24px', fontWeight: 700, letterSpacing: '0.18em',
                      textTransform: 'uppercase', color: '#fff', opacity: 0.85,
                    },
                    children: 'remboursés sur votre réparation',
                  },
                },
              ],
            },
          },
          // BLACK BOTTOM PLANE
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', top: '540px', left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column',
                padding: '80px 72px 60px',
              },
              children: [
                // Repair info big
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex', flexDirection: 'column',
                      marginTop: '40px',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: '20px', fontWeight: 600, letterSpacing: '0.22em',
                            textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
                            marginBottom: '14px',
                          },
                          children: 'Réparation',
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex', alignItems: 'baseline', gap: '20px',
                            fontSize: '88px', fontWeight: 900, letterSpacing: '-0.03em',
                            color: '#fff',
                          },
                          children: [
                            repair,
                            { type: 'span', props: { style: { fontSize: '40px', color: RED, fontWeight: 700 }, children: '·' } },
                            { type: 'span', props: { style: { fontSize: '52px', fontWeight: 700, opacity: 0.85 }, children: device } },
                          ],
                        },
                      },
                    ],
                  },
                },
                // Spacer
                { type: 'div', props: { style: { flex: 1 } } },
                // Tagline
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex', alignItems: 'center', gap: '20px',
                      fontSize: '22px', fontWeight: 700, letterSpacing: '0.22em',
                      textTransform: 'uppercase', color: '#fff',
                    },
                    children: [
                      'Pas d\'avance',
                      { type: 'span', props: { style: { width: '6px', height: '6px', background: RED, borderRadius: '50%', display: 'flex' } } },
                      'Pas de paperasse',
                      { type: 'span', props: { style: { width: '6px', height: '6px', background: RED, borderRadius: '50%', display: 'flex' } } },
                      { type: 'span', props: { style: { color: RED }, children: 'On s\'occupe de tout' } },
                    ],
                  },
                },
                // Bracket bottom right
                {
                  type: 'div',
                  props: {
                    style: {
                      position: 'absolute', right: '60px', bottom: '50px',
                      fontSize: '40px', fontWeight: 700, color: '#fff', opacity: 0.4,
                    },
                    children: '◣',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1080,
      height: 1080,
    }
  );
}
