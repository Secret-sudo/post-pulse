import { EN_HEADERS } from '../../tests/builders/f1.ts';
import { detectF1 } from './detect.ts';
import { lookupHeader, lookupPostType, normaliseLabel } from './headers.ts';

const REQUIRED = ['Post URL', 'Post Publish Date', 'Post type', 'Impressions'];
const OTHERS = EN_HEADERS.filter((h) => !REQUIRED.includes(h));

describe('header registry and detection (SPEC §4.4)', () => {
  it('TC-P12 matches headers regardless of case, spacing, punctuation and width', () => {
    for (const h of [
      'Impressions (in-network)',
      'impressions in network',
      'IMPRESSIONS (IN–NETWORK)',
      '  Impressions  (in-network) ',
      'Ｉｍｐｒｅｓｓｉｏｎｓ (in-network)',
    ]) {
      expect(
        lookupHeader(h).map((m) => m.field),
        h,
      ).toEqual(['inNetworkPct']);
    }
    expect(normaliseLabel('Avg. watch-time')).toBe('avg watch time');
  });

  it('TC-P11 maps the eight known post types', () => {
    for (const t of [
      'Image',
      'Video',
      'Repost',
      'Text',
      'Article',
      'Document',
      'Poll',
      'Celebration',
    ]) {
      expect(lookupPostType(t)).toBe(t);
    }
    expect(lookupPostType('video')).toBe('Video');
    expect(lookupPostType('Carousel')).toBeUndefined();
  });

  it('TC-P13 detects F1 with all 19 headers', () => {
    const d = detectF1([...EN_HEADERS]);
    expect(d.isF1).toBe(true);
    expect(d.language).toBe('en');
    expect(d.matchShare).toBe(1);
    expect(d.columns.impressions).toBe(3);
  });

  it('TC-P13 detects F1 at 16 of 19 fields (84 %)', () => {
    expect(detectF1([...REQUIRED, ...OTHERS.slice(0, 12)]).isF1).toBe(true);
  });

  it('TC-P13 rejects 14 of 19 fields (74 %)', () => {
    expect(detectF1([...REQUIRED, ...OTHERS.slice(0, 10)]).isF1).toBe(false);
  });

  it('TC-P13 rejects a sheet missing a required field and reports what it found', () => {
    const headers = EN_HEADERS.filter((h) => h !== 'Impressions');
    const d = detectF1(headers);
    expect(d.isF1).toBe(false);
    expect(d.missingRequired).toEqual(['impressions']);
    expect(d.headersFound).toEqual(headers);
  });

  it('TC-P14 keeps unknown columns aside as extras', () => {
    const d = detectF1([...EN_HEADERS, 'Hashtags']);
    expect(d.isF1).toBe(true);
    expect(d.extraColumns).toEqual([{ index: 19, header: 'Hashtags' }]);
  });
});
