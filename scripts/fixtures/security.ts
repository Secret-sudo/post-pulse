// Hostile export for TC-S04 (SPEC §11.2 syn-xss): HTML in a title and a post
// type, a javascript: link, and a spreadsheet formula as a title.
import { EN_HEADERS, f1Row } from '../../tests/builders/f1.ts';
import type { Cell } from '../../src/import/types.ts';

export const XSS_IDS = {
  html: '7400000000000008000',
  script: '7400000000000008001',
  formula: '7400000000000008002',
  normal: '7400000000000008003',
} as const;

export function xss(): Cell[][] {
  return [
    [...EN_HEADERS],
    f1Row({
      'Post URL': `https://www.linkedin.com/posts/sample_%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E-ugcPost-${XSS_IDS.html}-Xss1`,
      'Post type': '<b>x</b>',
      'Post Publish Date': '9/1/2026',
    }),
    f1Row({
      'Post URL': `javascript:alert(document.domain)//ugcPost-${XSS_IDS.script}`,
      'Post Publish Date': '9/2/2026',
    }),
    f1Row({
      'Post URL': `https://www.linkedin.com/posts/sample_%3DHYPERLINK(%22https%3A%2F%2Fevil.example%22%2C%22click%22)-ugcPost-${XSS_IDS.formula}-Xss3`,
      'Post Publish Date': '9/3/2026',
    }),
    f1Row({
      'Post URL': `https://www.linkedin.com/posts/sample_an-ordinary-post-ugcPost-${XSS_IDS.normal}-Xss4`,
      'Post Publish Date': '9/4/2026',
    }),
  ];
}

export const SECURITY_FIXTURES = {
  'syn-xss_2026-07-17_2026-10-14.xlsx': xss,
} as const;
