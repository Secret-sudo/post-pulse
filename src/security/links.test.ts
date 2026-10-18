import { safeLinkedInHref } from './links.ts';

describe('untrusted post links (SPEC §10.2)', () => {
  it('allows https LinkedIn links', () => {
    const url = 'https://www.linkedin.com/posts/sample_a-post-ugcPost-7400000000000000001-AbCd';
    expect(safeLinkedInHref(url)).toBe(url);
    expect(safeLinkedInHref('https://linkedin.com/feed/update/urn:li:activity:1')).not.toBeNull();
  });

  it('blocks scripts, other schemes, look-alike hosts and junk', () => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)//https://www.linkedin.com/',
      'data:text/html,<script>alert(1)</script>',
      'http://www.linkedin.com/posts/x',
      'https://www.linkedin.com.evil.example/posts/x',
      'https://evil-linkedin.com/posts/x',
      'not a url',
      '',
    ]) {
      expect(safeLinkedInHref(url), url).toBeNull();
    }
  });
});
