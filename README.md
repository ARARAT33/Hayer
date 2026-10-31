# ՀԱՅԵՐ — միասնական հայկական համայնք

HAYER-ը միասնական հայկական սոցիալական միջերես է՝ Matrix ֆեդերացիայի վրա։ Հիմնական միջերեսը հրապարակվում է GitHub Pages-ով. հաշիվները, սենյակները և հաղորդագրությունները պահվում են ընտրված հանրային Matrix homeserver-ում։

## Բովանդակության կանոն

**HAYER-ի Feed-ը և համայնքները ցուցադրում են միայն HAYER-ի հավելվածով ստեղծված հրապարակումները։** Արտաքին Mastodon, Pixelfed, Lemmy կամ PeerTube օգտատերերի գրառումները չեն ներմուծվում HAYER լրահոս։

## Հաշիվ և HAYID

- Մուտքն ու գրանցման փորձը կատարվում են Matrix Client-Server API-ով։
- HAYID-ը տվյալ պահին օգտատիրոջ ամբողջական Matrix ID-ն է, օրինակ՝ @օգտանուն:converser.eu։ Այն գլոբալ HAYER alias չէ և կախված է homeserver-ից։
- Նույն հաշիվը կարելի է օգտագործել այլ սարքում՝ նույն Matrix սերվերի տվյալներով մուտք գործելով։
- Որոշ homeserver-ներ պահանջում են email, CAPTCHA կամ ձեռքով հաստատում։ Այդ պահանջները հնարավոր չէ շրջանցել. նման դեպքում հաշիվը պետք է ստեղծել սերվերի պաշտոնական գրանցման էջում կամ Element-ում, ապա մուտք գործել HAYER։
- Առաջարկվող հանրային homeserver-ը converser.eu է։ Այն Matrix արձանագրության versions endpoint-ին պատասխանել է HTTP 200։ Գրանցման endpoint-ը GET հարցման համար վերադարձրել է 405, ինչը նորմալ է, քանի որ գրանցումը POST գործողություն է. իրական գրանցումը դեռ պետք է փորձարկվի օգտատիրոջ համաձայնությամբ։

## Գործառույթներ՝ Matrix ինտեգրում

- [x] Matrix հաշվի մուտք և գրանցման API-ի փորձ՝ սերվերի կանոններին համապատասխան։
- [x] Մուտքի session-ի պահպանում և նույն սարքում վերականգնում։
- [x] HAYID՝ ամբողջական Matrix ID, օգտատիրոջ որոնում ճշգրիտ ID-ով։
- [x] Matrix պրոֆիլի ցուցադրվող անվան և avatar URL-ի փոփոխություն։
- [x] HAYER Feed-ի room alias-ի հայտնաբերում/ստեղծում և HAYER գրառումների ուղարկում/ընթերցում։
- [x] Feed-ի հավանումների և մեկնաբանությունների Matrix իրադարձություններ։
- [x] Անձնական և խմբային Matrix սենյակներ՝ հրավերներով։
- [x] Բաց համայնքների ստեղծում/ցուցադրում/միացում, փակ և գաղտնի համայնքներ՝ հրավերային սենյակներով։
- [x] Փակ համայնքի միանալու հարցման ուղարկում և սեփականատիրոջ կողմից հաստատման/մերժման գործողություն։
- [ ] Երկու իրական օգտատերերով տարբեր սարքերի և տարբեր homeserver-ների end-to-end ընդունման թեստ։

## Կարևոր սահմանափակումներ

- HAYER-ի ընդհանուր Feed-ի canonical alias-ը #hayer-feed:converser.eu է։ Եթե այն դեռ գոյություն չունի, առաջին ստեղծող հաշիվը պետք է լինի converser.eu-ում։ Այլ homeserver-ից օգտվողները կարող են միանալ, երբ alias-ն արդեն ստեղծված է։
- Հանրային Matrix սերվերները անկախ օպերատորներ ունեն. հասանելիությունը, գրանցումը, CORS-ը, պահման ժամկետը և ֆայլի չափի սահմանները կարող են փոխվել։
- Այս տարբերակում ֆայլերի իրական upload-ը, հաճախորդային E2EE-ը, ձայնային/տեսազանգերը և call signaling-ը դեռ ավարտված չեն։ HTTPS հղում ուղարկելը ֆայլի upload չէ։
- Matrix սերվերը կարող է պահել հաղորդագրությունների և ֆայլերի բովանդակությունը։ Մի ուղարկիր զգայուն տվյալներ, մինչև E2EE-ը և սերվերի գաղտնիության պայմանները չստուգվեն։
- Հանրային համայնքների հայտնաբերումը կախված է homeserver-ի հանրային room directory-ից։ Տարբեր սերվերների directory-ները կարող են տարբեր լինել։

## Cloudflare-ի հեռացում

- HAYER-ի Cloudflare hayer-api Worker-ը և hayer-core D1 տվյալների բազան հեռացված են։
- Հեռացված է նաև repository-ի հին Worker source-ը՝ worker/index.js։
- Այլ Cloudflare նախագծեր և հաշվի ռեսուրսներ չեն փոփոխվել։
- HAYER frontend-ում հին workers.dev API հասցե այլևս չկա։

## Ստուգում

```bash
python scripts/validate.py
```

Ստուգման workflow-ն ստուգում է HTML/JS շարահյուսությունը և static Pages build-ը։ Դա չի փոխարինում իրական Matrix հաշիվներով բազմաօգտատեր փորձարկմանը։

## Matrix SDK integration (web client connected)

The first-party Matrix SDK is connected to the browser application:

- `matrix-js-sdk` is pinned to `45.0.0` and bundled into the static Pages deployment with esbuild.
- `src/matrix/client.js` provides homeserver discovery, SDK-based password login and registration, Rust Crypto initialization, sync startup, HAYER event namespace checks, room helpers and message helpers.
- Registration challenges are returned as structured UI-auth data so a future HAYER form can complete email/CAPTCHA/terms steps without sending the user to Element.
- `tests/matrix-client.test.js` validates homeserver URL handling and HAYER event namespacing.
- `.github/workflows/matrix-sdk-validation.yml` runs the SDK adapter checks.

**Important status:** this adapter is an initial foundation and is not yet wired into the currently published login/chat UI. The existing UI still uses its previous Matrix REST adapter. The Element handoff text has been removed from the HAYER login/registration screen. Registration uses the SDK and reports server interactive-authentication stages; the current form does not yet complete email/CAPTCHA stages. Do not treat E2EE, media upload, calls, or Android/Windows/Linux packaging as finished until the follow-on integration and real-device tests pass.

See [the SDK implementation plan](docs/MATRIX-SDK-IMPLEMENTATION.md).
