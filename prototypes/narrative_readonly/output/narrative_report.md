# Narrative detection prototype — read-only report

Generated: 2026-11-20T04:57:42.055858+00:00

> Prototype proposals only. No production records were changed. Inspect the linked articles before accepting any relationship.

## Dataset snapshot

- Articles read: **108**
- Saved event clusters: **93**; clusters analyzed: **93**
- Unassigned articles: **0**
- Publishers: BBC 44, Guardian 53, NPR 11
- Saved event cluster sizes: 1 article(s): 84 cluster(s), 2 article(s): 6 cluster(s), 3 article(s): 2 cluster(s), 6 article(s): 1 cluster(s)

## Proposed narrative groups

### 1. Trump / Xi / Putin / Russia — related event coverage

Review state: **proposed, unconfirmed**. Pairwise cosine range: 0.058–0.132.

#### Event: Ukraine / Putin / Europe (3 article(s); BBC, Guardian)

- [Europe ready for talks with Russia on ending war in Ukraine, leaders say](https://www.bbc.co.uk/news/articles/ckzd9nln5e6go) — BBC; published 2026-11-19T21:21:43
- [Ukraine allies warn ‘Yalta format’ will not bring about peace – as it happened](https://www.theguardian.com/world/live/2026/nov/19/russia-ukraine-war-coalition-of-the-willing-europe-latest-news-updates) — Guardian; published 2026-11-19T18:03:54
- [Is Europe now in the shadow of a Trump, Putin and Xi alliance? – podcast](https://www.theguardian.com/politics/audio/2026/nov/19/is-europe-in-shadow-of-trump-putin-xi-alliance-podcast) — Guardian; published 2026-11-19T17:23:36

#### Event: Anthony Zurcher: Trilateral summit high on spectacle, short on substance (1 article(s); BBC)

- [Anthony Zurcher: Trilateral summit high on spectacle, short on substance](https://www.bbc.co.uk/news/articles/cwn70vrjlg8ro) — BBC; published 2026-11-19T17:55:15

#### Event: Watch: What did Trump, Xi and Putin get out of their historic meeting? (1 article(s); BBC)

- [Watch: What did Trump, Xi and Putin get out of their historic meeting?](https://www.bbc.co.uk/news/videos/c63rgnq05pdwo) — BBC; published 2026-11-19T17:23:29

#### Event: China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars (1 article(s); Guardian)

- [China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars](https://www.theguardian.com/world/2026/nov/19/china-russia-us-agree-peace-statement-no-mention-ukraine-iran-wars) — Guardian; published 2026-11-19T17:13:23

#### Event: Trump accused of falling asleep during Xi Jinping speech at Apec summit in China (1 article(s); Guardian)

- [Trump accused of falling asleep during Xi Jinping speech at Apec summit in China](https://www.theguardian.com/us-news/2026/nov/19/trump-apec-asleep-china) — Guardian; published 2026-11-19T17:12:11

#### Event: New page in history? Xi, Trump and Putin summit was more of a footnote (1 article(s); Guardian)

- [New page in history? Xi, Trump and Putin summit was more of a footnote](https://www.theguardian.com/world/2026/nov/19/new-page-in-history-xi-trump-and-putin-summit-was-more-of-a-footnote) — Guardian; published 2026-11-19T15:35:01

#### Event: Top House Democrat questions what Trump accomplished in Xi-Putin summit (1 article(s); NPR)

- [Top House Democrat questions what Trump accomplished in Xi-Putin summit](https://www.npr.org/2026/11/19/nx-s1-6046487/gregory-meeks-trump-xi-putin-summit) — NPR; published 2026-11-19T11:20:37

#### Event: Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’ (1 article(s); Guardian)

- [Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’](https://www.theguardian.com/world/live/2026/nov/18/apec-summit-live-updates-xi-putin-trump-world-leaders-gather-in-china) — Guardian; published 2026-11-18T17:48:24

Relationship evidence:

- **Ukraine / Putin / Europe ↔ Watch: What did Trump, Xi and Putin get out of their historic meeting?** — cosine 0.124; shared entities: Putin, Trump, Xi; shared weighted terms: putin, xi, meeting, peace, talks, putin xi. Multiple shared named entities plus overlapping article language.
- **Ukraine / Putin / Europe ↔ China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars** — cosine 0.095; shared entities: Russia, Ukraine; shared weighted terms: ukraine, peace, putin, russia, xi, china. Multiple shared named entities plus overlapping article language.
- **Ukraine / Putin / Europe ↔ Trump accused of falling asleep during Xi Jinping speech at Apec summit in China** — cosine 0.058; shared entities: Trump, Xi; shared weighted terms: xi, trump, summit china, president, summit, china. Multiple shared named entities plus overlapping article language.
- **Ukraine / Putin / Europe ↔ New page in history? Xi, Trump and Putin summit was more of a footnote** — cosine 0.106; shared entities: Putin, Trump, Xi; shared weighted terms: putin, russia, ukraine, xi, yalta, meeting. Multiple shared named entities plus overlapping article language.
- **Ukraine / Putin / Europe ↔ Top House Democrat questions what Trump accomplished in Xi-Putin summit** — cosine 0.093; shared entities: Trump; shared weighted terms: putin, ukraine, xi, war ukraine, russia, summit. A distinctive shared named entity and supporting article-language overlap.
- **Ukraine / Putin / Europe ↔ Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’** — cosine 0.111; shared entities: Europe, Putin, Trump, Xi; shared weighted terms: putin, xi, europe, shenzhen, meeting, china. Multiple shared named entities plus overlapping article language.
- **Anthony Zurcher: Trilateral summit high on spectacle, short on substance ↔ Watch: What did Trump, Xi and Putin get out of their historic meeting?** — cosine 0.132; shared entities: none; shared weighted terms: meeting, xi, trilateral, historic, putin, trump. Strong lexical similarity with a shared distinctive term, despite limited shared headline entities.
- **Anthony Zurcher: Trilateral summit high on spectacle, short on substance ↔ China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars** — cosine 0.110; shared entities: none; shared weighted terms: meeting, trilateral summit, china, trilateral, summit, putin. Strong lexical similarity with a shared distinctive term, despite limited shared headline entities.
- **Watch: What did Trump, Xi and Putin get out of their historic meeting? ↔ China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars** — cosine 0.111; shared entities: none; shared weighted terms: putin, declaration, xi, meeting, peace, xi putin. Strong lexical similarity with a shared distinctive term, despite limited shared headline entities.
- **Watch: What did Trump, Xi and Putin get out of their historic meeting? ↔ New page in history? Xi, Trump and Putin summit was more of a footnote** — cosine 0.109; shared entities: Putin, Trump, Xi; shared weighted terms: putin, meeting, xi, trump, historic, trump xi. Multiple shared named entities plus overlapping article language.
- **Watch: What did Trump, Xi and Putin get out of their historic meeting? ↔ Top House Democrat questions what Trump accomplished in Xi-Putin summit** — cosine 0.089; shared entities: Trump; shared weighted terms: xi, putin, xi putin, meeting, trump, china. A distinctive shared named entity and supporting article-language overlap.
- **Watch: What did Trump, Xi and Putin get out of their historic meeting? ↔ Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’** — cosine 0.123; shared entities: Putin, Trump, Xi; shared weighted terms: xi, putin, meeting, trump xi, trump, china. Multiple shared named entities plus overlapping article language.
- **Trump accused of falling asleep during Xi Jinping speech at Apec summit in China ↔ New page in history? Xi, Trump and Putin summit was more of a footnote** — cosine 0.059; shared entities: Trump, Xi; shared weighted terms: trump, asleep, falling asleep, xi, summit, china. Multiple shared named entities plus overlapping article language.
- **Trump accused of falling asleep during Xi Jinping speech at Apec summit in China ↔ Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’** — cosine 0.068; shared entities: Apec, China, Trump, Xi; shared weighted terms: xi, trump, apec, apec summit, china, xi jinping. Multiple shared named entities plus overlapping article language.
- **New page in history? Xi, Trump and Putin summit was more of a footnote ↔ Top House Democrat questions what Trump accomplished in Xi-Putin summit** — cosine 0.080; shared entities: Trump; shared weighted terms: putin, putin summit, xi, summit, meeting, russia. A distinctive shared named entity and supporting article-language overlap.
- **New page in history? Xi, Trump and Putin summit was more of a footnote ↔ Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’** — cosine 0.095; shared entities: Putin, Trump, Xi; shared weighted terms: putin, xi, meeting, shenzhen, trump, summit. Multiple shared named entities plus overlapping article language.
- **Top House Democrat questions what Trump accomplished in Xi-Putin summit ↔ Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’** — cosine 0.078; shared entities: Trump; shared weighted terms: xi, putin, trump, meeting, summit, china. A distinctive shared named entity and supporting article-language overlap.

### 2. GTA 6 / GTA — related event coverage

Review state: **proposed, unconfirmed**. Pairwise cosine range: 0.086–0.142.

#### Event: GTA 6 breaks records as sales top $2.3bn - industry estimate (1 article(s); BBC)

- [GTA 6 breaks records as sales top $2.3bn - industry estimate](https://www.bbc.co.uk/news/articles/c9zr5nyv5dj2o) — BBC; published 2026-11-20T02:54:40

#### Event: Grand Theft Auto fans skip work and pull all-nighters to play new instalment (1 article(s); Guardian)

- [Grand Theft Auto fans skip work and pull all-nighters to play new instalment](https://www.theguardian.com/games/2026/nov/19/grand-theft-auto-six-fans-skip-work-pull-all-nighters) — Guardian; published 2026-11-19T20:07:23

#### Event: UK joins in GTA 6 frenzy as game becomes available worldwide (1 article(s); BBC)

- [UK joins in GTA 6 frenzy as game becomes available worldwide](https://www.bbc.co.uk/news/articles/c6z74ep2n17zo) — BBC; published 2026-11-19T12:26:39

Relationship evidence:

- **GTA 6 breaks records as sales top $2.3bn - industry estimate ↔ Grand Theft Auto fans skip work and pull all-nighters to play new instalment** — cosine 0.114; shared entities: GTA 6; shared weighted terms: gta, game, launch, year wait, instalment, wait. A distinctive shared named entity and supporting article-language overlap.
- **GTA 6 breaks records as sales top $2.3bn - industry estimate ↔ UK joins in GTA 6 frenzy as game becomes available worldwide** — cosine 0.086; shared entities: GTA, GTA 6; shared weighted terms: gta, game, entertainment, popular, worldwide, available. Multiple shared named entities plus overlapping article language.
- **Grand Theft Auto fans skip work and pull all-nighters to play new instalment ↔ UK joins in GTA 6 frenzy as game becomes available worldwide** — cosine 0.142; shared entities: GTA 6; shared weighted terms: gta, game, theft auto, grand theft, auto, theft. A distinctive shared named entity and supporting article-language overlap.

### 3. joanne / joanne young / drugged — related event coverage

Review state: **proposed, unconfirmed**. Pairwise cosine range: 0.205–0.205.

#### Event: 'The bravest woman in Britain' and 'Silence is not an option' (1 article(s); BBC)

- ['The bravest woman in Britain' and 'Silence is not an option'](https://www.bbc.co.uk/news/articles/ck1wr0dg9vwxo) — BBC; published 2026-11-20T01:05:29

#### Event: Joanne / Young / Joanne Young (2 article(s); BBC)

- [Woman drugged and advertised for sex by husband speaks out as abusers found guilty](https://www.bbc.co.uk/news/articles/crq5n5pe935no) — BBC; published 2026-11-19T22:17:29
- [Joanne Young was drugged and raped by strangers after her husband offered her online](https://www.bbc.co.uk/news/articles/cwly0kxk5xe5o) — BBC; published 2026-11-19T17:18:24

Relationship evidence:

- **'The bravest woman in Britain' and 'Silence is not an option' ↔ Joanne / Young / Joanne Young** — cosine 0.205; shared entities: none; shared weighted terms: joanne, joanne young, young, drugged, guilty, husband. Strong lexical similarity with a shared distinctive term, despite limited shared headline entities.

### 4. rwanda / asylum / countries — related event coverage

Review state: **proposed, unconfirmed**. Pairwise cosine range: 0.149–0.149.

#### Event: UK and EU plan first talks on sending refused asylum seekers to third countries (1 article(s); Guardian)

- [UK and EU plan first talks on sending refused asylum seekers to third countries](https://www.theguardian.com/uk-news/2026/nov/19/uk-eu-talks-asylum-seekers-third-country-hubs) — Guardian; published 2026-11-19T19:02:45

#### Event: Five EU states announce plans for immigration ‘return hubs’ in Rwanda (1 article(s); Guardian)

- [Five EU states announce plans for immigration ‘return hubs’ in Rwanda](https://www.theguardian.com/world/2026/nov/16/eu-states-immigration-return-hubs-rwanda) — Guardian; published 2026-11-17T01:10:59

Relationship evidence:

- **UK and EU plan first talks on sending refused asylum seekers to third countries ↔ Five EU states announce plans for immigration ‘return hubs’ in Rwanda** — cosine 0.149; shared entities: EU; shared weighted terms: rwanda, eu, hubs, asylum, countries, migration. Strong lexical similarity with a shared distinctive term, despite limited shared headline entities.

### 5. Anthropic — related event coverage

Review state: **proposed, unconfirmed**. Pairwise cosine range: 0.101–0.101.

#### Event: Anthropic / Shares / Company (2 article(s); BBC, NPR)

- [Anthropic becomes one of world's most valuable public companies in stock market debut](https://www.bbc.co.uk/news/articles/c3x29ggenz12o) — BBC; published 2026-11-19T23:33:51
- [Investors scramble for a piece of AI giant Anthropic in blockbuster IPO](https://www.npr.org/2026/11/19/nx-s1-6042558/anthropic-ipo-breaks-records-100-billion) — NPR; published 2026-11-19T10:00:00

#### Event: Protesters rally against Anthropic in New York and San Francisco after $2tn stock market debut (1 article(s); Guardian)

- [Protesters rally against Anthropic in New York and San Francisco after $2tn stock market debut](https://www.theguardian.com/technology/2026/nov/19/anthropic-ipo-protests) — Guardian; published 2026-11-19T21:52:19

Relationship evidence:

- **Anthropic / Shares / Company ↔ Protesters rally against Anthropic in New York and San Francisco after $2tn stock market debut** — cosine 0.101; shared entities: Anthropic; shared weighted terms: anthropic, ai, stock, nasdaq, stock market, market. A distinctive shared named entity and supporting article-language overlap.

## Weak links and likely false positives

- **likely false positive** (0.136): Eu Uk / Deal / Food ↔ UK and EU plan first talks on sending refused asylum seekers to third countries; entities: none; terms: eu, sides, uk, deal, eu uk, reset. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.133): 'The bravest woman in Britain' and 'Silence is not an option' ↔ Eu Uk / Deal / Food; entities: none; terms: britain, young, eu, uk, 000, allow. Lexical overlap without a shared named entity; likely a false positive.
- **weak** (0.108): Anthropic raises more than $100B in IPO. And, Dems nominate Jeffries for House speaker ↔ Incoming House majority leader Katherine Clark stresses Democratic unity; entities: House; terms: jeffries, house, majority, majority leader, leader, speaker. One cluster contains a mixed-topic roundup headline; the relationship may attach to only one part of that item.
- **likely false positive** (0.105): Ukraine / Putin / Europe ↔ Anthony Zurcher: Trilateral summit high on spectacle, short on substance; entities: none; terms: meeting, putin, xi, summit, china, putin xi. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.098): China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars ↔ New page in history? Xi, Trump and Putin summit was more of a footnote; entities: none; terms: putin, russia, china russia, meeting, xi, ukraine. Lexical overlap without a shared named entity; likely a false positive.
- **weak** (0.097): Anthropic raises more than $100B in IPO. And, Dems nominate Jeffries for House speaker ↔ Top House Democrat questions what Trump accomplished in Xi-Putin summit; entities: House; terms: xi, house, putin, trump, summit, rep. Overlap is mostly broad actors or geography; check for topic drift.
- **likely false positive** (0.094): Anthony Zurcher: Trilateral summit high on spectacle, short on substance ↔ Trump accused of falling asleep during Xi Jinping speech at Apec summit in China; entities: none; terms: trump, white house, xi, white, apec, summit. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.092): China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars ↔ Top House Democrat questions what Trump accomplished in Xi-Putin summit; entities: none; terms: putin, xi, nuclear, summit, ukraine, xi putin. Lexical overlap without a shared named entity; likely a false positive.
- **weak** (0.083): China, Russia and US agree peace declaration with no mention of Ukraine and Iran wars ↔ Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’; entities: China; terms: putin, xi, china, meeting, summit, trump. Overlap is mostly broad actors or geography; check for topic drift.
- **likely false positive** (0.081): Anthony Zurcher: Trilateral summit high on spectacle, short on substance ↔ New page in history? Xi, Trump and Putin summit was more of a footnote; entities: none; terms: meeting, putin, summit, xi, china, trump. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.079): Anthony Zurcher: Trilateral summit high on spectacle, short on substance ↔ Anthropic raises more than $100B in IPO. And, Dems nominate Jeffries for House speaker; entities: none; terms: trilateral, meeting, xi, trump, putin, house. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.079): Anthony Zurcher: Trilateral summit high on spectacle, short on substance ↔ Apec summit as it happened: Xi welcomes Trump on China visit as Putin claims Europe in ‘humiliating decline’; entities: none; terms: meeting, xi, putin, china, summit, trump. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.078): Trump accused of falling asleep during Xi Jinping speech at Apec summit in China ↔ Anthropic raises more than $100B in IPO. And, Dems nominate Jeffries for House speaker; entities: none; terms: trump, house, xi, president, speaker, summit china. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.075): 'The bravest woman in Britain' and 'Silence is not an option' ↔ Genocide / Rohingya / Myanmar; entities: none; terms: genocide, rohingya, myanmar, icj, genocide rohingya, international court. Lexical overlap without a shared named entity; likely a false positive.
- **weak** (0.074): Incoming House majority leader Katherine Clark stresses Democratic unity ↔ Top House Democrat questions what Trump accomplished in Xi-Putin summit; entities: House; terms: rep, edited, house, interview, trump, web. Overlap is mostly broad actors or geography; check for topic drift.
- **likely false positive** (0.072): Watch: What did Trump, Xi and Putin get out of their historic meeting? ↔ Anthropic raises more than $100B in IPO. And, Dems nominate Jeffries for House speaker; entities: none; terms: putin, xi, meeting, trump, trilateral, xi putin. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.071): Trump DoJ moves to drop legal challenge to Mary Peltola’s Alaska Senate win ↔ California’s top lawyer subpoenas Nvidia over Jensen Huang’s affair with suspected Chinese spy – live; entities: none; terms: senate, race, vote, republican, york, new york. Lexical overlap without a shared named entity; likely a false positive.
- **weak** (0.071): Appeals court rejects Democrat LaMonica McIver’s bid to toss charges over ICE protest ↔ Eight-year-old Haitian boy returns home after release from ICE custody; entities: ICE; terms: immigration, ice, homeland security, homeland, detention, representative. Some specific overlap exists, but it is below the prototype's proposal threshold.
- **likely false positive** (0.070): California’s top lawyer subpoenas Nvidia over Jensen Huang’s affair with suspected Chinese spy – live ↔ Anthropic raises more than $100B in IPO. And, Dems nominate Jeffries for House speaker; entities: none; terms: vote, closed door, senate, door, closed, house. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.068): The midterms were the largest win for either party in 50 years ↔ Incoming House majority leader Katherine Clark stresses Democratic unity; entities: none; terms: democrats, house, majority, house majority, party, congress. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.066): Eu Uk / Deal / Food ↔ Ukraine / Putin / Europe; entities: none; terms: eu, talks, europe, european, summit, brussels. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.065): Eu Uk / Deal / Food ↔ Five EU states announce plans for immigration ‘return hubs’ in Rwanda; entities: none; terms: eu, scheme, british, europe, european, sources. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.062): Israeli tanks cross ‘yellow line’ boundary into Hamas-controlled central Gaza ↔ Eight injured after driver in Israel repeatedly rams car into Palestinians; entities: none; terms: palestinians, israel, israeli, palestinian, central, incident. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.062): Anthony Zurcher: Trilateral summit high on spectacle, short on substance ↔ Top House Democrat questions what Trump accomplished in Xi-Putin summit; entities: none; terms: meeting, xi, summit, putin, trump, china. Lexical overlap without a shared named entity; likely a false positive.
- **likely false positive** (0.061): Ukraine / Putin / Europe ↔ Anthropic raises more than $100B in IPO. And, Dems nominate Jeffries for House speaker; entities: none; terms: putin, xi, trump, leaders, meeting, summit. Lexical overlap without a shared named entity; likely a false positive.
- **weak** (0.060): Trump accused of falling asleep during Xi Jinping speech at Apec summit in China ↔ Top House Democrat questions what Trump accomplished in Xi-Putin summit; entities: Trump; terms: xi, trump, chinese, summit, president, president xi. Some specific overlap exists, but it is below the prototype's proposal threshold.
- **likely false positive** (0.060): UK and EU plan first talks on sending refused asylum seekers to third countries ↔ European Commission accused of sugarcoating figures to release funds to Egypt; entities: none; terms: eu, pact, leaked, von der, ursula von, ursula. Lexical overlap without a shared named entity; likely a false positive.
- **weak** (0.060): Anthropic / Shares / Company ↔ Anthropic raises more than $100B in IPO. And, Dems nominate Jeffries for House speaker; entities: Anthropic; terms: anthropic, ipo, ai, anthropic raises, bubble, raises. Some specific overlap exists, but it is below the prototype's proposal threshold.
- **likely false positive** (0.060): California’s top lawyer subpoenas Nvidia over Jensen Huang’s affair with suspected Chinese spy – live ↔ Incoming House majority leader Katherine Clark stresses Democratic unity; entities: none; terms: incoming, caucus, democrats, leadership, majority, democratic. Lexical overlap without a shared named entity; likely a false positive.
- **weak** (0.059): William and Catherine's India tour was 'particularly special', aide says ↔ Weekly quiz: Which star played cricket with Catherine in India?; entities: India; terms: catherine, catherine india, india, young people, days, uk. Some specific overlap exists, but it is below the prototype's proposal threshold.

## Interpretation and limits

The highest-confidence proposals are candidate cross-event relationships surfaced from real saved clusters. The weak-link section is an explicit review queue for topic drift and false positives. The score is lexical similarity, not a probability.

Named entities come from a small capitalization heuristic. It can miss names and can mistake title-case words for entities. The report does not infer cause, intent, or a single overarching story without human review.

Full article bodies are not copied into this report; use the publisher links to inspect the source context.
