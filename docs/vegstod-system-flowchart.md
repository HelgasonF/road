# Iceland Road Assistance — heildarferli kerfisins

Uppfært 21. október 2026. Flæðið hér sýnir núverandi handvirkar
WhatsApp-sendingar og tvær aðskildar myPOS-greiðslur.

```mermaid
flowchart TD
    A[Viðskiptavinur hringir í móttöku] --> B[Móttaka skráir símanúmer og býr til öruggan formtengil]
    B --> C[Móttaka sendir tilbúin skilaboð handvirkt í WhatsApp Business]
    C --> D[Viðskiptavinur fyllir út nafn, staðsetningu, bílgögn og lýsingu; myndir eru valfrjálsar]
    D --> E[Pay and submit: upplýsingar vistast og myPOS opnast]
    E --> F[Fyrsta greiðsla: fast upphafsgjald 10.490 ISK]
    F --> G[Bakgrunnsvinnsla staðfestir Paid í myPOS API og skilar vistuðu upplýsingunum]
    G --> H[Röðun og úthlutun opnast; móttaka sér staðfestingu sjálfkrafa]
    H --> I[Móttaka kannar framboð og fær verðtilboð frá ökumanni]
    I --> J[Móttaka slær inn aðskilda þjónustufjárhæð og lýsingu]
    J --> K[Móttaka sendir einkatengil á greiðsluyfirlit handvirkt í WhatsApp]
    K --> L[Viðskiptavinur greiðir hjá myPOS án þess að skrá upplýsingarnar aftur]
    L --> M[API staðfestir seinni greiðsluna; staðan uppfærist sjálfkrafa]
    H --> N[Móttaka stjórnar úthlutun og sendir einnota aðgangstengil ökumanns]
    N --> O[Ökumaður samþykkir, sinnir verkinu og uppfærir stöðu]
    O --> P[Verki lýkur og reikningsuppgjör heldur áfram í Uppgjöri]
    P --> Q[Móttaka skráir reikning og innborgun greiðanda]
    P --> R[Móttaka samþykkir reikning þjónustuaðila og skráir útborgun]
    Q --> S[Báðir reikningsleggir greiddir: fulluppgert]
    R --> S
```

## WhatsApp og upplýsingar

Allar sendingar eru handvirkar úr WhatsApp Business-reikningi fyrirtækisins.
Kerfið útbýr skilaboðin og örugga tengla; starfsmaður yfirfer viðtakanda og
ýtir á **Send**. Cloud API-sendingar eru í bið. Afhendingar- og lesstaða
handvirkra skilaboða er skoðuð í WhatsApp.

Viðskiptavinurinn skráir upplýsingar og myndir í kerfið. Myndir eru í einkageymslu
Supabase og verða aðgengilegar úthlutuðum ökumanni. Hann opnar einnota
aðgangstengil, staðfestir **Opna ökumannsskjá** og sér aðeins heimilaðar upplýsingar.
Hann þarf hvorki netfang né lykilorð. Móttaka ræður úthlutun og tímasetningu hennar;
seinni greiðsla er aðskilin frá aðgangi ökumanns og framvindu verks.

## Tvær greiðslur og uppgjör

Upphafsgjaldið er alltaf **10.490 ISK**. Seinni greiðslan er sjálfstæð fjárhæð
sem móttaka slær inn eftir verðtilboð ökumanns; upphafsgjaldið dregst ekki frá
henni. Viðskiptavinurinn skráir upplýsingar einu sinni og þarf ekki að snúa aftur
af myPOS-síðunni til að þær skili sér. Leiðréttingarform eftir staðfest
upphafsgjald notar **Send details securely** og innheimtir það ekki aftur.

Bakgrunnsvinnsla athugar myPOS um það bil á mínútu fresti. Greiðsluspjaldið hjá
móttöku sækir staðfesta gagnagrunnsstöðu á 15 sekúndna fresti meðan þess þarf.
Greiðslustaðfesting lýkur ekki verkinu og merkir ekki sjálfkrafa reikninga eða
þjónustuaðila sem uppgerða. Reikningshald og útgreiðsla til þjónustuaðila eru
aðskilin frá þessum tveimur myPOS-greiðslum.

Sjá [myPOS-uppsetningu](MYPOS_SETUP.md), [núverandi stöðu](implementation-status.md)
og [lokið símapróf](live-phone-audit-2026-10-21.md).

## Eldra kynningarflæðirit

[SVG](assets/vegstod-system-flowchart.svg) og
[PNG](assets/vegstod-system-flowchart.png) eru varðveittar eldri kynningarmyndir.
Þær sýna fyrra Cloud API-flæði og innihalda ekki nýja tveggja greiðslna ferlið.
Notið uppfærða flæðið hér að ofan fyrir núverandi kerfi.
