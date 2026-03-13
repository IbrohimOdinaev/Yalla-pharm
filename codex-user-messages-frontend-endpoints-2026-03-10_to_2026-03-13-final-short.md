[2026-03-10 11:58:28 +05] session=019cd668-7286-7633-9f7e-ec5a781924c5
Neoboxodimo dobavit Amazon S3 - dlya xranenniya kartionok dlya Medicine. Sozdat novuyu sushnost MedicineImage s polyami Id, key(s3klyuch dlya dostupa   kkartinke , tip string), IsMain(bool) , isMinimal(bool), medicineId eto dannie xranyashiesya v nashem bd o k...

[2026-03-10 13:18:35 +05] session=019cd668-7286-7633-9f7e-ec5a781924c5
kakie vidish uyazvimosti v registracii lekarstva i dobavleniya dlya nego image

[2026-03-10 13:40:04 +05] session=019cd668-7286-7633-9f7e-ec5a781924c5
1) pereprover vse testi obichnie i integracionnie, prover na pokritie vsex sluchaev uspeshnix i oshibki dobav testi na novie servisi. 2) Sdelay krasiviy html css js front krasiviy so vsem funksicinoalov

[2026-03-10 14:52:58 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
izmeni front: 1) Otdelnie okna dlya: (registraciya , login), (prosmotr kataloga tovarov esli tovarov net nadpis tovarov net), (prosmotr profilya infu o sebe), (prosmotr korzini), (pri najatii na tovar pokazivat vsyu kartochku) poxojee na yandeapteki.

[2026-03-10 15:12:06 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
Unhandled exception for GET /api/medicines. TraceId: 0HNJUHK31HL8B:00000014. StatusCode: 500. ErrorCode: internal_error Npgsql.PostgresException (0x80004005): 42P01: relation "medicine_images" does not exist  POSITION: 240    at Npgsql.Internal.NpgsqlConnector...

[2026-03-10 15:20:15 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
dobav v configuracii User novogo SuperAdmin s nomerom telefona (4444) i parolerm (admin4444) i s imenem (SuperAdmin), dobav migracii i obnovi database plus nezabud dlya SuperAdmin i Admin sdelat takoy je interface kak i klientu dlya ix funkcionala

[2026-03-10 15:55:32 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
funkcional Admin: Upravleniya zakazami apteki, postavka im statusa sobiraetsya, sobran i edet, prosmotr istorii zakazov apteki filtraciya po statusam zakazov. funkcional SuperAdmin: REgistraciya i udalenie Admin i Pharmacy, dobavlenie obnovlenie udalenie karto...

[2026-03-10 15:56:01 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
funkcional Admin: Upravleniya zakazami apteki, postavka im statusa sobiraetsya, sobran i edet, prosmotr istorii zakazov apteki filtraciya po statusam   zakazov. funkcional SuperAdmin: REgistraciya i udalenie Admin i Pharmacy, dobavlenie obnovlenie udalenie kar...

[2026-03-10 16:22:42 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
Handled exception for GET /api/medicines/151f1262-0d39-487e-9bd4-db66d0fe54a4. TraceId: 0HNJUIO4V7DIA:00000018. StatusCode: 400. ErrorCode: invalid_operation. ExceptionType: InvalidOperationException pochemu vixodit takoy exception dlya neaktivnix kartochek to...

[2026-03-10 16:26:11 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
dlya Admin udalit funkcional (front + back) po upravleniyu sotrudnikami i upravleniyu lekarstvami. u SuperAdmin dobavit zagruzku kartinki dlya tovara chtob tovari otobrajalis s ix kartinkoy

[2026-03-10 16:36:24 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
Unhandled exception for POST /api/medicines/images. TraceId: 0HNJUJ2SKHNAQ:0000000B. StatusCode: 500. ErrorCode: internal_error System.NullReferenceException: Object reference not set to an instance of an object.    at Minio.DataModel.Response.NewMultipartUplo...

[2026-03-11 13:41:20 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
Sdelay front bolee udobnim kak nastocyashaya ecommerece apteka (tolko polzovatelskuyu chast). v primer mojesh vzyat yandexapteki

[2026-03-11 14:33:53 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
dobav ogranichenie v 9 cifr dlya nomerat telefona i pomenyay nomer telefona SuperAdmin na 919191919

[2026-03-11 15:58:40 +05] session=019cd728-30de-7363-8a71-fb0aff2a7975
prosmotri pochemu v tekushem proekte front nepokazivaet kartniki lekarstv. Vsyo zapusheno cherez docker 3 aktivnix tekushix konteynera

[2026-03-12 11:23:35 +05] session=019ce0b3-22fc-7e80-8637-515816a16a88
Context: tekushiy proekt e-commerce apteka s client-side, admin-side, superAdmin-side. Vnedri tekushie izmeneniya v proekt. 1) SuperAdmin: v kartochkax tovarov dobav knopku po udaleniyu i deaktivacii tovarov (takje dobavit polnoe udalenie so vsemi dannimi Medi...

[2026-03-12 11:25:12 +05] session=019ce0b3-22fc-7e80-8637-515816a16a88
Context: tekushiy proekt e-commerce apteka s client-side,   admin-side, superAdmin-side. Vnedri tekushie izmeneniya v   proekt. 1) SuperAdmin: v kartochkax tovarov dobav knopku po   udaleniyu i deaktivacii tovarov (takje dobavit polnoe udalenie   so vsemi dann...

[2026-03-12 13:38:42 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
ontext: tekushiy proekt e-commerce apteka s client-side,     admin-side, superAdmin-side. Vnedri tekushie izmeneniya v     proekt. 1) SuperAdmin: v kartochkax tovarov dobav knopku po     udaleniyu i deaktivacii tovarov (takje dobavit polnoe   udalenie     so v...

[2026-03-12 14:00:00 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
sozday enpoint dlya Admin: 1) dobavlenie offer (kolichsetvo i cenu) ne konkretniy medicine i privyazat ego k nemu soxraniv v bd. ryadom so znachkom YallaPharmacy dobav nazvanie interface(klientskihy, adminskiy, ili SuperADminskiy) . Uberi nijnie 2 bloka pro in...

[2026-03-12 14:11:00 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
da dlya SuperAdmin neoboxidmo videt vse offeri Medciines v podrovnoy informacii ob medicine, Klient toje doljen videt offeri aptek. a v korzine kak mi zadumivali neobxodimo pokazat v kakoy apteke skolko budet stoit u nas est uje gotovie metodi

[2026-03-12 15:08:48 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
Dobavit: Ogranichenie i validaciyu nomerat telefona dlya logina i parolya delat takje na urovne fronta dlya bistroti i govorit srazu chto naprimer nujno kak minimum 8 simvolov dlya parolya. Dobavit Oformlenie i Cancel zakaza dlya Clienta - metodi  dlya etogo s...

[2026-03-12 15:20:08 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
dobav dlya admin podtverjdenie perexodov statusov kak uje est v backand (perexod v status sobiraetsya, gotov, i edet) dlya zakazov svoey apteki. a dlya SuperAdmin perexod statusa lyubogo zakaza v Delivered i filtraciya po statusam zakazov.

[2026-03-12 15:26:13 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
> docker logs yalla-api [10:24:29 WRN] Storing keys in a directory '/root/.aspnet/DataProtection-Keys' that may not be persisted outside of the container. Protected data will be unavailable when container is destroyed. For more information go to https://aka.ms...

[2026-03-12 15:34:44 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
tekushie oshibki posle oformleniya nevischitivaetsya stoimost zakaza v istorii i pokazivaetsya vsegda 0, postav na urvone back i front ograncheniya chtob nelzvya bilo perevesti zakaza na stage nazad ili pereprignut stage

[2026-03-12 15:42:36 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
proskaniruy servisi po oformleniyu zakaza na korrektnost

[2026-03-13 00:08:15 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
razve v versii etogo proekta togo vremeni nebilo kontrollerov i fronta?

[2026-03-13 02:07:04 +05] session=019ce132-a803-7911-97c7-54b36ba69f9f
a kasaem fronta ti dobavil vse neobxodimie izmeneniya?

