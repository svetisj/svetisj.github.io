<p align="center">
  <img src="assets/ihs-logo.svg" alt="IHS" width="100">
</p>

# Isusovački sveci i blaženici

Hrvatska digitalna zbirka života i svjedočanstava svetaca, blaženika i slugu Božjih povezanih s Družbom Isusovom.

**Adresa stranice:** [svetisj.github.io](https://svetisj.github.io/)

Zbirka sadrži **223 profila**: 59 svetaca, 162 blaženika i dvije osobe u skupini Sluge Božji. Uključuje i laičke suradnike te suputnike isusovačkih mučenika. Svaki profil donosi životopis, raspoložive biografske podatke, sliku i poveznice na izvore.

## Što se nalazi u zbirci

- **Kartice** s portretima i cjelovitim uvodima u životopise.
- **Popis** po povijesnim razdobljima i kanonskim skupinama.
- **Godišnji kalendar** s pregledom datuma i prelaskom na pojedini mjesec.
- **Pretraživanje po imenu** i drugim zabilježenim oblicima imena, uz podršku za hrvatske dijakritičke znakove.
- **Djelovanje**: 16 kategorija prema dokumentiranim iskustvima i djelovanju, uz barem jednu kategoriju za svaku osobu.
- **Razdoblje**: stoljeća života od 15. do 20. stoljeća.
- **Status**: sveci, blaženici, sluge Božji i laici. Jedna sklopiva kontrola **Filtri** objedinjuje djelovanje, razdoblje, status i skupine, uz višestruki odabir, brojač odabira i prikaz rezultata. Odabrane stavke ostaju vidljive i nakon zatvaranja.
- **Skupine**: svih 12 kategorija zbirke nalazi se unutar kontrole Filtri i vrijedi za kartice, popis i kalendar.
- **Spremljeni profili** i prilagodljiva veličina teksta, uz pamćenje odabira na uređaju.
- **Dijeljenje i ispis** životopisa.
- **Izvanmrežno čitanje** nakon spremanja zbirke, uz mogućnost dodavanja na početni zaslon.

Svaki životopis ima i zasebnu adresu, primjerice [Sv. Ignacije Lojolski](https://svetisj.github.io/osoba/ignacije-lojolski/). Stranice profila mogu se čitati bez JavaScripta; JavaScript omogućuje pretraživanje i ostale interakcije u zbirci.

## Izvori i uredničke napomene

Životopisi i podaci oslanjaju se na [Molitvenik](https://molitvenik.app/sveci), [službeni imenik Družbe Isusove](https://www.jesuits.global/about-us/saints-and-blessed/) te hrvatske izvore HKM, Župu Jastrebarsko i Bitno.net. Poveznice i podaci o slikama navedeni su uz pojedine profile. Za 53 sveca potvrđena je i poveznica na osobnu stranicu u službenom isusovačkom imeniku.

Životopisi su izvorni hrvatski sažeci i sinteze, sastavljeni uz pomoć umjetne inteligencije prema navedenim izvorima. Dulji životopisi dopunjeni su dodatnim provjerenim crkvenim i stručnim izvorima, koji su svi povezani uz tekst. Ne predstavljaju potpune prijevode izvornih članaka. Tekst blaženog Ivana Merza prilagođen je iz hrvatskog izvora.

Za 217 osoba podatci su usklađeni s uredničkom tablicom: kalendar prati **Datum proslave**, a profili donose raspoložive datume i mjesta rođenja i smrti, okolnosti mučeništva, ulogu, pripadnost, druge oznake, oblike imena i izvore. Šest dodatnih profila zadržava ranije podatke. Nepotpuni datumi i razlike među izvorima izričito su označeni.

## Statička objava

Ovaj repozitorij sadrži **samo gotove statičke datoteke stranice i ovaj README**. Za posluživanje nisu potrebni Node.js, Python, baza podataka ni aplikacijski poslužitelj.

```text
.
├── index.html                 # Zbirka: kartice, popis i kalendar
├── app.js                     # Interakcije u pregledniku
├── styles.css                 # Izgled i prilagodba uređajima
├── ui-config.js               # Oznake i skupine u sučelju
├── assets/                    # IHS logo, portreti, ikone i slika za dijeljenje
├── data/                      # Podaci zbirke
├── osoba/                     # 223 statičkih stranica životopisa
├── manifest.webmanifest       # Podaci za instalaciju aplikacije
├── sw.js                      # Izvanmrežno spremanje i verzije predmemorije
├── offline-assets.json        # Popis datoteka za izvanmrežno čitanje
├── sitemap.xml                # 224 URL-ova za tražilice
├── robots.txt                 # Pravila indeksiranja i adresa sitemapa
├── 404.html                   # Stranica za nepostojeće poveznice
└── .nojekyll                  # Posluživanje bez obrade Jekyllom
```

### GitHub Pages

U postavkama repozitorija otvorite **Settings → Pages** i odaberite:

1. **Source:** Deploy from a branch.
2. **Branch:** `main`.
3. **Folder:** `/ (root)`.

Nakon slanja datoteka na tu granu GitHub Pages objavljuje statički sadržaj. Za ovaj način objave nije potreban vlastiti GitHub Actions workflow. [GitHubove upute za odabir izvora objave](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

SEO metapodaci, kanonske adrese i sitemap podešeni su za **https://svetisj.github.io/**. Nakon javne objave sitemap se može prijaviti u Google Search Console na adresi `https://svetisj.github.io/sitemap.xml`.

### Izvanmrežna uporaba

Preglednik tijekom uporabe sprema učitane sadržaje za kasnije čitanje. Za dodavanje na početni zaslon upotrijebite izbornik preglednika. Instalacija i predmemorija dostupne su na HTTPS-u ili lokalnom poslužitelju.

## Ažuriranje sadržaja

Urednički izvori, razvojni alati, provjere i radne bilješke vode se u zasebnom razvojnom projektu, izvan ovog repozitorija. Ovdje se prenosi njegov gotov statički izlaz, zajedno s usklađenim popisom izvanmrežnih datoteka i novom verzijom service workera.

Slike, tekstovi i pripadajući izvori zadržavaju svoje autore i navedene podatke o podrijetlu. Kontakt je dostupan preko gumba u podnožju stranice.
