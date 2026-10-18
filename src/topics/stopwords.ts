// Stop words for EN/DE/FR titles (SPEC §4.5, §8). Used by the hashtag-opener
// rule now and topic suggestions in Phase 2. SPEC §4.5 lists the words that
// MUST be present; `ai` MUST NOT be, because it is a common hashtag stem.

const EN = `a an the and or but nor of to in on at as be by for from about over under into onto
with without is are was were been being am has have had do does did can could will would shall
should may might must it its this these that those i me my we us our you your he him his she her
they them their no not so if then than too very just only also how what when where who why which`;

const DE = `der die das den dem des ein eine einer eines einem einen und oder aber doch ist sind war
waren hat haben hatte am im in an auf aus bei mit nach von vor zu zum zur für über unter durch
wir ich du er sie es ihr mein dein sein unser euer nicht kein keine auch noch nur schon wie was
wer wo wann warum dass ob als wenn so sich man mehr heute`;

const FR = `le la les l un une des du de d et ou mais donc est sont était été a ont au aux dans
sur sous avec sans pour par en ce cet cette ces je tu il elle nous vous ils elles ne pas plus
que qui quoi où quand comment se sa son ses leur leurs mon ma mes`;

export const STOP_WORDS: ReadonlySet<string> = new Set(
  [EN, DE, FR].join(' ').split(/\s+/).filter(Boolean),
);
