<p align="center">
  <img src="assets/ihs-logo.svg" alt="IHS" width="100">
</p>

# Isusovački sveci i blaženici

Hrvatska digitalna zbirka života i svjedočanstava svetaca, blaženika i slugu Božjih povezanih s Družbom Isusovom.

**Adresa stranice:** [svetisj.github.io](https://svetisj.github.io/)

Zbirka sadrži **214 profila**: 57 svetaca, 155 blaženika i dvije osobe u skupini Sluge Božji. Uključuje i laičke suradnike te suputnike isusovačkih mučenika. Svaki profil donosi životopis, raspoložive biografske podatke, sliku i poveznice na izvore.

## Što se nalazi u zbirci

- **Kartice** s portretima i cjelovitim uvodima u životopise.
- **Popis** po povijesnim razdobljima i kanonskim skupinama.
- **Godišnji kalendar** s pregledom datuma i prelaskom na pojedini mjesec.
- **Pretraživanje** po imenima, drugim oblicima imena i sadržaju.
- **Spremljeni profili** i prilagodljiva veličina teksta, uz pamćenje odabira na uređaju.
- **Dijeljenje, ispis i preuzimanje datuma** za osobni kalendar.
- **Izvanmrežno čitanje** nakon spremanja zbirke, uz mogućnost dodavanja na početni zaslon.

Svaki životopis ima i zasebnu adresu, primjerice [Sv. Ignacije Lojolski](https://svetisj.github.io/osoba/ignacije-lojolski/). Stranice profila mogu se čitati bez JavaScripta; JavaScript omogućuje pretraživanje i ostale interakcije u zbirci.

## Izvori i uredničke napomene

Životopisi i podaci oslanjaju se na [Molitvenik](https://molitvenik.app/sveci), [službeni imenik Družbe Isusove](https://www.jesuits.global/about-us/saints-and-blessed/) te hrvatske izvore HKM, Župu Jastrebarsko i Bitno.net. Poveznice i podaci o slikama navedeni su uz pojedine profile. Za 53 sveca potvrđena je i poveznica na osobnu stranicu u službenom isusovačkom imeniku.

Tekstovi blaženika s engleskih izvora sažeti su i prilagođeni hrvatskom jeziku uz pomoć umjetne inteligencije, što je naznačeno uz tekstove. Ne predstavljaju potpune prijevode izvornih članaka. Tekst blaženog Ivana Merza prilagođen je iz hrvatskog izvora.

Za uvezene isusovačke blaženike kalendar prikazuje datum smrti prema pravilu ove zbirke. Za sluge Božje datum je označen kao **godišnjica smrti**. Postojeći datumi svetaca i dodatni zajednički spomendani ostaju posebno navedeni. Nepoznati podaci o zaštitništvu nisu dopunjavani pretpostavkama.

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
├── osoba/                     # 214 statičkih stranica životopisa
├── manifest.webmanifest       # Podaci za instalaciju aplikacije
├── sw.js                      # Izvanmrežno spremanje i verzije predmemorije
├── offline-assets.json        # Popis datoteka za izvanmrežno čitanje
├── sitemap.xml                # 215 URL-ova za tražilice
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

Na stranici odaberite **Spremi za izvanmrežnu uporabu** kako bi se svi životopisi i slike spremili na uređaj. Preglednik prikazuje napredak i potvrdu dovršetka. Instalacija i izvanmrežno spremanje rade na HTTPS-u ili lokalnom poslužitelju. Pri dostupnosti nove verzije zbirke može se odabrati **Učitaj novu verziju**.

## Ažuriranje sadržaja

Urednički izvori, razvojni alati, provjere i radne bilješke vode se u zasebnom razvojnom projektu, izvan ovog repozitorija. Ovdje se prenosi njegov gotov statički izlaz, zajedno s usklađenim popisom izvanmrežnih datoteka i novom verzijom service workera.

Slike, tekstovi i pripadajući izvori zadržavaju svoje autore i navedene podatke o podrijetlu. Kontakt razvijatelja dostupan je preko gumba u podnožju stranice.
