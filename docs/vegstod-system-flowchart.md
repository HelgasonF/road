# Vegstoð — heildarferli kerfisins

![Flæðirit Vegstoðar frá fyrstu beiðni til uppgjörs](assets/vegstod-system-flowchart.svg)

[Opna flæðiritið eitt og sér](assets/vegstod-system-flowchart.svg) · [Sækja PNG-mynd](assets/vegstod-system-flowchart.png)

## Hlutverk WhatsApp

WhatsApp er samskiptaleiðin utan um Vegstoð, en ekki geymslustaður verkefnisins. Það kemur þrisvar inn í flæðið:

1. Móttaka sendir viðskiptavininum öruggan Vegstoð-tengil í WhatsApp.
2. Móttaka sendir hentugum ökumanni stutta, persónuverndaða fyrirspurn um framboð í WhatsApp.
3. Eftir úthlutun sendir móttaka ökumanninum staðfestingu og einkvæman, tímabundinn innskráningartengil á Vegstoð í WhatsApp.

Viðskiptavinurinn setur staðsetningu, bílgögn, lýsingu og myndir **inn í Vegstoð**. Myndirnar eru í einkageymslu Supabase og fara ekki í gegnum WhatsApp. Úthlutaður ökumaður opnar WhatsApp-tengilinn, staðfestir að hann vilji opna ökumannsskjáinn og fær þar nákvæman kortapinna, upplýsingar um viðskiptavin, bílgögn og heimilaðar myndir. Ökumaður gefur ekki upp netfang og býr ekki til lykilorð.

Móttaka yfirfer alltaf tilbúin WhatsApp-skilaboð og ýtir sjálf á **Senda**. Vegstoð notar því ekki greitt WhatsApp Business API og getur ekki fullyrt að ytri skilaboð hafi verið send, lesin eða þeim svarað.

## Staða miðað við núverandi byggingu

- Viðskiptavinaflæðið byrjar á **+**: móttaka slær aðeins inn símanúmer og velur **Búa til og opna WhatsApp**. Þá verður til verkefni sem bíður upplýsinga og skráð númer opnast með einföldum leiðbeiningum á ensku og öruggum tengli. Viðskiptavinurinn velur aðstoð, skrifar lýsingu og skráir staðsetningu og bílgögn; fyrst þá opnast röðun og úthlutun. Móttaka getur líka valið að fylla allt verkefnið út sjálf.
- Ökumannsflæðið er einnig tengt beint við WhatsApp: framboðsfyrirspurn og úthlutunar-/innskráningartengill opnast með tilbúnum texta. Innskráningartengillinn er aðeins nothæfur einu sinni; nýr tengill er búinn til þegar þarf.
- Í öllum tilvikum fer móttaka yfir textann og ýtir sjálf á **Senda** í WhatsApp. Gögn og myndir eru áfram inni í Vegstoð.

## Greiðsluflæðið

Greiðandinn greiðir alltaf Vegstoð. Greiðandinn getur verið viðskiptavinurinn, bílaleiga, trygginga-/aðstoðarfélag eða fyrirtæki. Þjónustuaðilinn sendir sinn reikning til Vegstoðar og Vegstoð greiðir honum sérstaklega. Málið telst **fulluppgert** fyrst þegar báðir leggir eru greiddir.
