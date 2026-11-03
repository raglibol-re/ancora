// German for every English text passed to t() (ui/i18n.ts), addressing people with "Sie".
// ancora stays lowercase, as in English. i18n.test.ts checks nothing used in the code is missing.

export const de: Readonly<Record<string, string>> = {
	Language: "Sprache",
	"Welcome to ancora": "Willkommen bei ancora",
	"Your passkey is your login. It creates your own account on Stellar, which represents you in every organization you join. No seed phrase, no password, fees are sponsored.":
		"Ihr Passkey ist Ihr Login. Er legt Ihr eigenes Konto auf Stellar an, das Sie in jeder Organisation vertritt, der Sie beitreten. Keine Seed-Phrase, kein Passwort, die Gebühren werden übernommen.",
	"Your name": "Ihr Name",
	"Shown to the organizations you work with.":
		"Sichtbar für die Organisationen, mit denen Sie arbeiten.",
	"Creating your account…": "Ihr Konto wird angelegt…",
	"Create my passkey": "Meinen Passkey erstellen",
	"already have one?": "Schon einen?",
	"Waiting for your passkey…": "Warte auf Ihren Passkey…",
	"Sign in with my passkey": "Mit meinem Passkey anmelden",
	"Stellar testnet with test money. Passkeys are tied to this website's domain.":
		"Stellar-Testnet mit Testgeld. Passkeys sind an die Domain dieser Website gebunden.",
	'Lost your pass? Create a new one above, then open Your pass → "Recover an old pass": the guardians you named confirm the new pass and your positions move over.':
		"Pass verloren? Erstellen Sie oben einen neuen und öffnen Sie dann Ihr Pass → „Alten Pass wiederherstellen“: Die von Ihnen benannten Vertrauenspersonen bestätigen den neuen Pass, und Ihre Positionen gehen auf ihn über.",
	"Look around with sample data instead": "Stattdessen mit Beispieldaten umsehen",
	"Your passkey is your account": "Ihr Passkey ist Ihr Konto",
	"Face ID or a fingerprint creates your own account on Stellar. Its address is your ancora ID: one identity for every organization you belong to, no seed phrase to lose.":
		"Face ID oder ein Fingerabdruck legt Ihr eigenes Konto auf Stellar an. Seine Adresse ist Ihre ancora-ID: eine Identität für jede Organisation, zu der Sie gehören, ohne Seed-Phrase, die verloren gehen kann.",
	"Rules the organization enforces itself": "Regeln, die die Organisation selbst durchsetzt",
	"Each organization is its own contract. Approval tiers, four-eyes, objection windows and new-recipient checks run on-chain, and the rules are one readable document whose fingerprint the contract stores.":
		"Jede Organisation ist ein eigener Vertrag. Freigabestufen, Vier-Augen-Prinzip, Einspruchsfristen und Prüfungen neuer Empfänger laufen on-chain, und die Regeln sind ein lesbares Dokument, dessen Fingerabdruck der Vertrag speichert.",
	"Several stablecoins, one account": "Mehrere Stablecoins, ein Konto",
	"EURC, USDC and more side by side, each with its own balance. Rules are written in your home currency; adding a stablecoin is a decision the organization takes together.":
		"EURC, USDC und mehr nebeneinander, jeweils mit eigenem Saldo. Die Regeln gelten in Ihrer Heimatwährung; einen Stablecoin hinzuzufügen entscheidet die Organisation gemeinsam.",
	"A Reserve, not a savings account": "Eine Reserve, kein Sparkonto",
	"Idle money goes into a DeFindex vault on Stellar with one tap and comes back whenever you need it. Earnings are variable and come from Blend lending, not from the stablecoin itself. Not a bank deposit, not insured.":
		"Ungenutztes Geld fließt mit einem Tippen in einen DeFindex-Tresor auf Stellar und kommt zurück, wann immer Sie es brauchen. Die Erträge sind variabel und stammen aus Blend-Krediten, nicht aus dem Stablecoin selbst. Keine Bankeinlage, nicht versichert.",
	"A security seal for large payments": "Ein Sicherheitssiegel für große Zahlungen",
	"Above a threshold the organization sets, a payment needs an extra seal from an approver. Organizations can require it to be signed with a quantum-safe ML-DSA key that never leaves the approving device; the organization checks it on Stellar before the money moves.":
		"Ab einer Schwelle, die die Organisation festlegt, braucht eine Zahlung ein zusätzliches Siegel einer freigebenden Person. Organisationen können verlangen, dass es mit einem quantensicheren ML-DSA-Schlüssel signiert wird, der das freigebende Gerät nie verlässt; die Organisation prüft es auf Stellar, bevor Geld fließt.",
	"Decide together": "Gemeinsam entscheiden",
	"Reasons for and against, questions and comments on every request, with thumbs up and down. Approvers see what the group thinks before they sign.":
		"Gründe dafür und dagegen, Fragen und Kommentare zu jeder Anfrage, mit Daumen hoch und runter. Wer freigibt, sieht vor der Unterschrift, was die Gruppe denkt.",
	"Create your passkey": "Passkey erstellen",
	"Thirty seconds, no app store, no seed phrase. Your pass shows your ancora ID and a QR code others use to invite you.":
		"Dreißig Sekunden, kein App Store, keine Seed-Phrase. Ihr Pass zeigt Ihre ancora-ID und einen QR-Code, mit dem andere Sie einladen.",
	"Create or join an organization": "Organisation gründen oder beitreten",
	"Pick a template (club, company, team), the currency of the rules and the stablecoins you accept. Invite people by their ancora ID.":
		"Wählen Sie eine Vorlage (Verein, Unternehmen, Team), die Währung der Regeln und die Stablecoins, die Sie annehmen. Laden Sie Personen über ihre ancora-ID ein.",
	"Pay, approve, earn": "Zahlen, freigeben, Erträge erzielen",
	"Send money from your wallet or any Stellar wallet, approve on the go, keep the rest in the Reserve. Fees are sponsored.":
		"Senden Sie Geld aus Ihrer Wallet oder jeder Stellar-Wallet, geben Sie unterwegs frei, und halten Sie den Rest in der Reserve. Die Gebühren werden übernommen.",
	"€ EURC": "€ EURC",
	"$ USDC": "$ USDC",
	"Rules on-chain": "Regeln on-chain",
	"⚓ Stellar": "⚓ Stellar",
	"ancora: the business account your organization controls":
		"ancora: das Geschäftskonto, das Ihre Organisation selbst steuert",
	Sections: "Abschnitte",
	Features: "Funktionen",
	"How it works": "So funktioniert es",
	Security: "Sicherheit",
	"Sign in": "Anmelden",
	"Get started": "Loslegen",
	"Programmable business account on Stellar": "Programmierbares Geschäftskonto auf Stellar",
	"The business account": "Das Geschäftskonto,",
	"your organization controls.": "das Ihre Organisation selbst steuert.",
	"For clubs, companies, NGOs and teams. One passkey per person, one account per organization, rules the account enforces itself.":
		"Für Vereine, Unternehmen, NGOs und Teams. Ein Passkey pro Person, ein Konto pro Organisation, Regeln, die das Konto selbst durchsetzt.",
	"Get started →": "Loslegen →",
	"Scroll to features": "Zu den Funktionen scrollen",
	"See how it works": "So funktioniert es",
	"Everything an organization needs from its account":
		"Alles, was eine Organisation von ihrem Konto braucht",
	"Built on what Stellar already has": "Gebaut auf dem, was Stellar schon bietet",
	"OpenZeppelin smart accounts": "OpenZeppelin Smart Accounts",
	"Your passkey signs through an audited smart account; the private key never leaves your device. ancora's operator sponsors fees and holds no role anywhere.":
		"Ihr Passkey signiert über einen geprüften Smart Account; der private Schlüssel verlässt Ihr Gerät nie. Der Betreiber von ancora übernimmt die Gebühren und hat nirgends eine Rolle.",
	"Verifiable rules": "Überprüfbare Regeln",
	"Approval rules are a canonical document. The organization contract stores its SHA-256, so anyone can check that what you read is what it enforces.":
		"Freigaberegeln sind ein kanonisches Dokument. Der Vertrag der Organisation speichert seinen SHA-256-Wert, sodass jede Person prüfen kann, dass das, was Sie lesen, auch durchgesetzt wird.",
	"Open menu": "Menü öffnen",
	"Your pass": "Ihr Pass",
	Menu: "Menü",
	"Close menu": "Menü schließen",
	Main: "Hauptmenü",
	More: "Mehr",
	"Sample data:": "Beispieldaten:",
	"Showing sample data instead.": "Stattdessen werden Beispieldaten angezeigt.",
	Retry: "Erneut versuchen",
	"Stellar testnet:": "Stellar-Testnet:",
	"real transactions with test money; the rules run in your organization's contract. Signed in as {name}.":
		"echte Transaktionen mit Testgeld; die Regeln laufen im Vertrag Ihrer Organisation. Angemeldet als {name}.",
	"Updating from Stellar…": "Wird von Stellar aktualisiert…",
	Change: "Ändern",
	"Simulated:": "Simuliert:",
	"sample data, not on the Stellar testnet. Viewing as {name}.":
		"Beispieldaten, nicht im Stellar-Testnet. Ansicht als {name}.",
	"Switch person": "Person wechseln",
	Overview: "Übersicht",
	Inbox: "Eingang",
	Send: "Senden",
	Approvals: "Freigaben",
	Activity: "Aktivität",
	Deals: "Vereinbarungen",
	"Confidential pot": "Vertrauliche Kasse",
	Organization: "Organisation",
	"Approval rules": "Freigaberegeln",
	Budgets: "Budgets",
	"People & limits": "Personen & Limits",
	"Address book": "Adressbuch",
	"Payment links": "Zahlungslinks",
	"Settings & logo": "Einstellungen & Logo",
	Rules: "Regeln",
	"Network & data": "Netzwerk & Daten",
	Audit: "Prüfung",
	"About ancora": "Über ancora",
	"This page doesn't exist.": "Diese Seite gibt es nicht.",
	"Check the address, or go back to your account.":
		"Prüfen Sie die Adresse oder kehren Sie zu Ihrem Konto zurück.",
	"Open ancora": "ancora öffnen",
	"No organization yet": "Noch keine Organisation",
	"Create an organization to get an account, set your rules and invite your people.":
		"Gründen Sie eine Organisation, um ein Konto zu erhalten, Ihre Regeln festzulegen und Ihre Leute einzuladen.",
	"Create organization": "Organisation gründen",
	"New organization": "Neue Organisation",
	"Organization settings": "Einstellungen der Organisation",
	"Not protected yet.": "Noch nicht geschützt.",
	"This passkey is the only key to your positions. Add a second passkey or name guardians.":
		"Dieser Passkey ist der einzige Schlüssel zu Ihren Positionen. Fügen Sie einen zweiten Passkey hinzu oder benennen Sie Vertrauenspersonen.",
	"Protect my pass": "Meinen Pass schützen",
	"Remind me in a week": "In einer Woche erinnern",
	"Every movement of the organization's money, searchable.":
		"Jede Bewegung des Geldes der Organisation, durchsuchbar.",
	All: "Alle",
	In: "Eingang",
	Out: "Ausgang",
	Reserve: "Reserve",
	Find: "Suchen",
	Search: "Suche",
	"Name, reference, category or amount": "Name, Verwendungszweck, Kategorie oder Betrag",
	Asset: "Währung",
	"All assets": "Alle Währungen",
	Month: "Monat",
	"All months": "Alle Monate",
	Direction: "Richtung",
	"in {in} · out {out} · net {net}": "Eingang {in} · Ausgang {out} · netto {net}",
	"Download these as CSV": "Als CSV herunterladen",
	"1 movement": "1 Bewegung",
	"{count} movements": "{count} Bewegungen",
	"No movements yet. Deposits, payments and Reserve moves appear here.":
		"Noch keine Bewegungen. Einzahlungen, Zahlungen und Bewegungen der Reserve erscheinen hier.",
	"Nothing matches. Clear the search or pick another month.":
		"Keine Treffer. Leeren Sie die Suche oder wählen Sie einen anderen Monat.",
	"View transaction": "Transaktion ansehen",
	"Payments come from the organization's contract; deposits and Reserve moves from the Stellar ledger, about the last week plus what this device has read before.":
		"Zahlungen stammen aus dem Vertrag der Organisation; Einzahlungen und Bewegungen der Reserve aus dem Stellar-Ledger, etwa die letzte Woche plus das, was dieses Gerät früher gelesen hat.",
	"Back to activity": "Zurück zur Aktivität",
	"Print or save as PDF": "Drucken oder als PDF speichern",
	"Statement for {month}": "Auszug für {month}",
	"Sample data, not on Stellar.": "Beispieldaten, nicht auf Stellar.",
	"Money in": "Eingänge",
	"Money out": "Ausgänge",
	"Net this month": "Netto in diesem Monat",
	"Balance today": "Saldo heute",
	Date: "Datum",
	Description: "Beschreibung",
	Reference: "Verwendungszweck",
	Amount: "Betrag",
	"ancora is not a bank; balances are not deposit-insured. Amounts are in each asset's own currency. Reserve moves stay inside the organization and count in neither direction.":
		"ancora ist keine Bank; Guthaben unterliegen keiner Einlagensicherung. Beträge stehen in der Währung des jeweiligen Stablecoins. Bewegungen der Reserve bleiben in der Organisation und zählen in keine Richtung.",
	"Payments and changes in {organization}.": "Zahlungen und Änderungen in {organization}.",
	"Show requests": "Anfragen anzeigen",
	Open: "Offen",
	"Objection window": "Einspruchsfrist",
	Done: "Erledigt",
	"Nothing waits for approval": "Nichts wartet auf Freigabe",
	"Nothing here yet": "Noch nichts hier",
	"Every payment and every change to people or rules becomes a request here. Your rules decide who approves what:":
		"Jede Zahlung und jede Änderung an Personen oder Regeln wird hier zur Anfrage. Ihre Regeln entscheiden, wer was freigibt:",
	"Send a payment": "Zahlung senden",
	"Invite a member": "Mitglied einladen",
	"Expert details": "Details für Fachleute",
	"Request ID": "Anfrage-ID",
	"Organization ID": "Organisations-ID",
	"Rule tier": "Regelstufe",
	"Within the requester's spending limit (no tier)":
		"Im Ausgabelimit der anfragenden Person (keine Stufe)",
	Budget: "Budget",
	"No category": "Keine Kategorie",
	" · over budget (strictest tier)": " · über Budget (strengste Stufe)",
	"Smart account": "Smart Account",
	"On-chain reference": "On-chain-Referenz",
	"Request not found": "Anfrage nicht gefunden",
	"This request doesn't exist or belongs to an organization you're not part of.":
		"Diese Anfrage gibt es nicht, oder sie gehört zu einer Organisation, der Sie nicht angehören.",
	"Back to approvals": "Zurück zu den Freigaben",
	Request: "Anfrage",
	"← Approvals": "← Freigaben",
	"Rules for this request": "Regeln für diese Anfrage",
	"The rules were fixed when the request was created on":
		"Die Regeln wurden beim Erstellen der Anfrage festgelegt am",
	History: "Verlauf",
	"Requests across all your organizations that are waiting for your approval.":
		"Anfragen aus all Ihren Organisationen, die auf Ihre Freigabe warten.",
	"You're all caught up. Nothing is waiting for you.": "Alles erledigt. Nichts wartet auf Sie.",
	"Share access to private details": "Zugang zu vertraulichen Angaben teilen",
	"Access shared.": "Zugang geteilt.",
	"Waiting for access": "Wartet auf Zugang",
	"set up and can't read your private references yet. Your device can share the key with them.":
		"eingerichtet und kann Ihre vertraulichen Verwendungszwecke noch nicht lesen. Ihr Gerät kann den Schlüssel teilen.",
	"Share access": "Zugang teilen",
	"Account on Stellar": "Konto auf Stellar",
	Address: "Adresse",
	'The organization\'s own contract. Any of the stablecoins it accepts (see Rules) sent to this address arrives on its balances. A plain Stellar payment can\'t reach a contract address: use "Add money" above to send from your wallet, or a wallet that can pay contracts (Freighter). Bank deposits and withdrawals go through a Stellar anchor: tap an account above, then "Add" or "To a bank account".':
		"Der eigene Vertrag der Organisation. Jeder Stablecoin, den sie annimmt (siehe Regeln), kommt an diese Adresse gesendet auf ihren Salden an. Eine einfache Stellar-Zahlung erreicht keine Vertragsadresse: Nutzen Sie oben „Geld hinzufügen“, um aus Ihrer Wallet zu senden, oder eine Wallet, die Verträge bezahlen kann (Freighter). Ein- und Auszahlungen per Bank laufen über einen Stellar-Anchor: Tippen Sie oben auf ein Konto und dann auf „Hinzufügen“ oder „Auf ein Bankkonto“.",
	"Account number": "Kontonummer",
	IBAN: "IBAN",
	BIC: "BIC",
	"Account holder": "Kontoinhaber",
	"SEPA transfers to this IBAN arrive in euros on your main account. Provided by a licensed payment partner.":
		"SEPA-Überweisungen an diese IBAN kommen in Euro auf Ihrem Hauptkonto an. Bereitgestellt von einem lizenzierten Zahlungspartner.",
	"No account number yet. Euro account numbers come from a licensed payment partner after a short business verification.":
		"Noch keine Kontonummer. Euro-Kontonummern stellt ein lizenzierter Zahlungspartner nach einer kurzen Prüfung des Unternehmens aus.",
	"See all and search": "Alle ansehen und suchen",
	CSV: "CSV",
	"No movements yet. Add money to the account to see the first deposit here; payments, Reserve moves and approved changes follow, each with its transaction on Stellar.":
		"Noch keine Bewegungen. Fügen Sie dem Konto Geld hinzu, dann erscheint hier die erste Einzahlung; Zahlungen, Bewegungen der Reserve und freigegebene Änderungen folgen, jeweils mit ihrer Transaktion auf Stellar.",
	"Movements come from the Stellar ledger: about the last week is read, and what this device has read stays listed. Older ones are on the explorer.":
		"Bewegungen stammen aus dem Stellar-Ledger: Etwa die letzte Woche wird gelesen, und was dieses Gerät gelesen hat, bleibt aufgeführt. Ältere finden Sie im Explorer.",
	"Enter an amount like 25 or 100.50.": "Geben Sie einen Betrag wie 25 oder 100,50 ein.",
	"{amount} {asset} arrived from your wallet.":
		"{amount} {asset} aus Ihrer Wallet sind angekommen.",
	"Test {asset} arrived on the account.": "Test-{asset} ist auf dem Konto angekommen.",
	"Organization address copied.": "Adresse der Organisation kopiert.",
	"Couldn't copy. Select the address and copy it by hand.":
		"Kopieren fehlgeschlagen. Markieren Sie die Adresse und kopieren Sie sie von Hand.",
	"Add {asset}": "{asset} hinzufügen",
	"From your wallet": "Aus Ihrer Wallet",
	"Freighter, Hana, xBull or Albedo on testnet. ancora prepares the transfer to the organization's contract; your wallet only signs it.":
		"Freighter, Hana, xBull oder Albedo im Testnet. ancora bereitet die Überweisung an den Vertrag der Organisation vor; Ihre Wallet signiert sie nur.",
	Disconnect: "Trennen",
	"This wallet holds none of this asset. It needs a trustline for exactly":
		"Diese Wallet hält nichts von dieser Währung. Sie braucht eine Trustline für genau",
	"and some balance.": "und etwas Guthaben.",
	"Amount ({currency})": "Betrag ({currency})",
	"Waiting for your wallet…": "Warte auf Ihre Wallet…",
	"Connect wallet": "Wallet verbinden",
	"Test money": "Testgeld",
	"From any other wallet": "Aus jeder anderen Wallet",
	"Copy address": "Adresse kopieren",
	"All of it available": "Alles verfügbar",
	"Add money": "Geld hinzufügen",
	Add: "Hinzufügen",
	"To a bank account": "Auf ein Bankkonto",
	"Move to Reserve": "In die Reserve",
	"Move to account": "Aufs Konto",
	"No Reserve for": "Noch keine Reserve für",
	"yet.": ".",
	"From a bank account": "Von einem Bankkonto",
	"Through the Stellar anchor": "Über den Stellar-Anchor",
	"(testnet: a test bank, no real money). Your wallet signs in, the anchor's form takes the bank details, the":
		"(Testnet: eine Testbank, kein echtes Geld). Ihre Wallet meldet sich an, das Formular des Anchors nimmt die Bankdaten auf, das",
	"arrives in your wallet, and from there it goes to the organization.":
		"kommt in Ihrer Wallet an, und von dort geht es an die Organisation.",
	"Open the anchor's form": "Formular des Anchors öffnen",
	"Start another deposit": "Weitere Einzahlung starten",
	"Signing in with the anchor…": "Anmeldung beim Anchor…",
	"Start a bank deposit": "Bankeinzahlung starten",
	"Payment request to the anchor created. It follows your rules like any payment.":
		"Zahlungsanfrage an den Anchor erstellt. Sie folgt Ihren Regeln wie jede Zahlung.",
	"{asset} to a bank account": "{asset} auf ein Bankkonto",
	"Reaching the anchor…": "Anchor wird erreicht…",
	"doesn't pay out": "zahlt nicht aus:",
	"Start a bank withdrawal": "Bankauszahlung starten",
	"The anchor asks for": "Der Anchor erwartet",
	to: "an",
	"with reference “": "mit Verwendungszweck „",
	Only: "Nur",
	"is available on the main account.": "sind auf dem Hauptkonto verfügbar.",
	"Create the payment request": "Zahlungsanfrage erstellen",
	"Edit in Rules": "In den Regeln bearbeiten",
	"Total ·": "Gesamt ·",
	Includes: "Enthält",
	", Simulated": ", simuliert",
	"). Rates are for this view only; the rules don't use them.":
		"). Die Kurse gelten nur für diese Ansicht; die Regeln nutzen sie nicht.",
	"not included: no rate available right now.": "nicht enthalten: gerade kein Kurs verfügbar.",
	"{available} available, {waiting} waiting in requests, {reserve} in the Reserve":
		"{available} verfügbar, {waiting} in Anfragen gebunden, {reserve} in der Reserve",
	"Available now": "Jetzt verfügbar",
	"Waiting in requests": "In Anfragen gebunden",
	"In the Reserve · DeFindex": "In der Reserve · DeFindex",
	Accounts: "Konten",
	available: "verfügbar",
	"Rules are written in": "Die Regeln gelten in",
	". Tap an account for its Reserve and the ways to add money.":
		". Tippen Sie auf ein Konto für seine Reserve und die Wege, Geld hinzuzufügen.",
	"Waiting for you": "Wartet auf Sie",
	"Quick actions": "Schnellaktionen",
	"Money the organization doesn't need right now earns in a DeFindex vault on Stellar. Earnings are variable, moves are one tap and need no approval because the money never leaves the organization. Not a bank deposit; not insured.":
		"Geld, das die Organisation gerade nicht braucht, erwirtschaftet in einem DeFindex-Tresor auf Stellar Erträge. Die Erträge sind variabel, Bewegungen brauchen ein Tippen und keine Freigabe, weil das Geld die Organisation nie verlässt. Keine Bankeinlage; nicht versichert.",
	"None of the accepted assets has a DeFindex vault on testnet yet; BlendUSDC has one.":
		"Für keine der angenommenen Währungen gibt es im Testnet schon einen DeFindex-Tresor; BlendUSDC hat einen.",
	"Move in": "Einzahlen",
	"Move out": "Auszahlen",
	"Enter an amount like 500 or 1,250.50.": "Geben Sie einen Betrag wie 500 oder 1.250,50 ein.",
	"Move {amount} to the Reserve": "{amount} in die Reserve verschieben",
	"Move {amount} to the main account": "{amount} auf das Hauptkonto verschieben",
	"Done. The balances are updated.": "Erledigt. Die Salden sind aktualisiert.",
	"Move to the Reserve": "In die Reserve verschieben",
	"Move to the main account": "Auf das Hauptkonto verschieben",
	Cancel: "Abbrechen",
	Move: "Verschieben",
	"Add at least one payment.": "Fügen Sie mindestens eine Zahlung hinzu.",
	"Line {line} needs a recipient and an amount above zero.":
		"Zeile {line} braucht einen Empfänger und einen Betrag über null.",
	"Send {amount} to {count} recipients": "{amount} an {count} Empfänger senden",
	"Pay with": "Zahlen mit",
	"Recipient {number}": "Empfänger {number}",
	"G… or C… or a saved name": "G… oder C… oder ein gespeicherter Name",
	"IBAN or a saved name": "IBAN oder ein gespeicherter Name",
	"Remove line {number}": "Zeile {number} entfernen",
	"Add a line": "Zeile hinzufügen",
	Total: "Gesamt",
	recipients: "Empfänger",
	"Budget category": "Budgetkategorie",
	None: "Keine",
	"Reference for the whole batch": "Verwendungszweck für den ganzen Sammelauftrag",
	"Private, like every line's reference: only your organization reads them (about 70 characters each).":
		"Vertraulich wie der Verwendungszweck jeder Zeile: Nur Ihre Organisation liest sie (jeweils etwa 70 Zeichen).",
	"Shown to approvers.": "Sichtbar für alle, die freigeben.",
	"Too long to keep private; shorten it.": "Zu lang, um vertraulich zu bleiben; bitte kürzen.",
	"Coaches, October": "Trainer, Oktober",
	"Request the batch": "Sammelauftrag anfragen",
	"{count} payments from {file}. Check them, then request the batch.":
		"{count} Zahlungen aus {file}. Prüfen Sie sie und fragen Sie dann den Sammelauftrag an.",
	"Import from a spreadsheet (CSV)": "Aus einer Tabelle importieren (CSV)",
	"One payment per row: recipient (address or a saved name), amount, reference. A header row is fine. Amounts with a decimal comma need semicolons between the columns, as European spreadsheets export them.":
		"Eine Zahlung pro Zeile: Empfänger (Adresse oder gespeicherter Name), Betrag, Verwendungszweck. Eine Kopfzeile ist in Ordnung. Beträge mit Dezimalkomma brauchen Semikolons zwischen den Spalten, wie europäische Tabellen sie exportieren.",
	"Send money": "Geld senden",
	"From the account of {organization}.": "Vom Konto von {organization}.",
	Recipients: "Empfänger",
	"One recipient": "Ein Empfänger",
	"Several (batch)": "Mehrere (Sammelauftrag)",
	"Save {name} in the address book": "{name} im Adressbuch speichern",
	"{name} is in the address book.": "{name} ist im Adressbuch.",
	"Pay {amount} to {recipient} {interval}": "{amount} an {recipient} zahlen, {interval}",
	"Standing order set. The first payment runs now, under the rules.":
		"Dauerauftrag eingerichtet. Die erste Zahlung läuft jetzt, nach den Regeln.",
	"Send {amount} to {recipient}": "{amount} an {recipient} senden",
	"The rules are written in {currency}; a payment in another currency takes the strictest tier.":
		"Die Regeln gelten in {currency}; eine Zahlung in einer anderen Währung nimmt die strengste Stufe.",
	"no balance": "kein Guthaben",
	" · recipient can receive it": " · Empfänger kann es empfangen",
	Recipient: "Empfänger",
	"(organization on ancora)": "(Organisation auf ancora)",
	"New recipient…": "Neuer Empfänger…",
	Name: "Name",
	"Stellar address": "Stellar-Adresse",
	"Save to the address book.": "Im Adressbuch speichern.",
	"Everyone in": "Alle in",
	"then sees this name for the address.": "sehen dann diesen Namen für die Adresse.",
	"This address can receive": "Diese Adresse kann empfangen:",
	"Optional. The payment counts against this budget; beyond it the rules escalate or refuse.":
		"Optional. Die Zahlung zählt gegen dieses Budget; darüber hinaus verschärfen die Regeln die Freigabe oder lehnen ab.",
	Repeat: "Wiederholen",
	"A standing order pays again on schedule; every run follows the rules like a one-off payment.":
		"Ein Dauerauftrag zahlt planmäßig erneut; jede Ausführung folgt den Regeln wie eine Einzelzahlung.",
	Once: "Einmalig",
	"Secure handover.": "Sichere Übergabe.",
	"After approval the money is set aside and only paid out once the recipient and":
		"Nach der Freigabe wird das Geld zurückgelegt und erst ausgezahlt, wenn der Empfänger und",
	"both confirm. You get a link to send the recipient.":
		"beide bestätigen. Sie erhalten einen Link für den Empfänger.",
	"Private: only your organization reads it (about 70 characters).":
		"Vertraulich: Nur Ihre Organisation liest ihn (etwa 70 Zeichen).",
	"Shown to approvers and on the statement.":
		"Sichtbar für alle, die freigeben, und auf dem Auszug.",
	Continue: "Weiter",
	"Set standing order": "Dauerauftrag einrichten",
	"Enter an amount to see what your rules require.":
		"Geben Sie einen Betrag ein, um zu sehen, was Ihre Regeln verlangen.",
	"Your organization only pays recipients on its allowlist, and this one isn't on it. Ask for them to be added on the Rules page.":
		"Ihre Organisation zahlt nur an Empfänger auf ihrer Freigabeliste, und dieser steht nicht darauf. Bitten Sie auf der Seite Regeln darum, ihn hinzuzufügen.",
	"Beyond what is left of the #": "Mehr als noch übrig im Budget #",
	"budget this": "für",
	"). It is a hard budget, so this payment won't be accepted.":
		"). Es ist ein festes Budget, daher wird diese Zahlung nicht angenommen.",
	of: "von",
	"left this": "übrig für",
	"; this payment goes beyond it.": "; diese Zahlung geht darüber hinaus.",
	"Inside your allowance": "Innerhalb Ihres Kontingents",
	"This recipient isn't on your allowlist, so the strictest approvals apply.":
		"Dieser Empfänger steht nicht auf Ihrer Freigabeliste, daher gelten die strengsten Freigaben.",
	"Your spending limit:": "Ihr Ausgabelimit:",
	"; this payment goes through the normal rules.":
		"; diese Zahlung läuft über die normalen Regeln.",
	"Includes the extra check for a first payment to a new recipient.":
		"Enthält die zusätzliche Prüfung für eine erste Zahlung an einen neuen Empfänger.",
	"every week": "jede Woche",
	"Every week": "Jede Woche",
	"every two weeks": "alle zwei Wochen",
	"Every two weeks": "Alle zwei Wochen",
	"every month": "jeden Monat",
	"Every month": "Jeden Monat",
	"every {count} days": "alle {count} Tage",
	"every {count} hours": "alle {count} Stunden",
	"Standing orders": "Daueraufträge",
	"This organization was created before standing orders existed; organizations created from today can repeat a payment weekly, fortnightly or monthly.":
		"Diese Organisation wurde vor den Daueraufträgen gegründet; ab heute gegründete Organisationen können eine Zahlung wöchentlich, zweiwöchentlich oder monatlich wiederholen.",
	'None yet. Choose "Repeat" on the form above to pay someone weekly, fortnightly or monthly; every run follows the organization\'s rules like a one-off payment.':
		"Noch keine. Wählen Sie oben im Formular „Wiederholen“, um jemanden wöchentlich, zweiwöchentlich oder monatlich zu bezahlen; jede Ausführung folgt den Regeln der Organisation wie eine Einzelzahlung.",
	"Due now": "Jetzt fällig",
	"· set by": "· eingerichtet von",
	"Standing order run: the payment follows the rules from here.":
		"Dauerauftrag ausgeführt: Die Zahlung folgt ab hier den Regeln.",
	"Run now": "Jetzt ausführen",
	"Stop the standing order to {recipient}": "Dauerauftrag an {recipient} beenden",
	"Standing order stopped.": "Dauerauftrag beendet.",
	Stop: "Beenden",
	"Link copied. Send it to the recipient to confirm.":
		"Link kopiert. Senden Sie ihn zur Bestätigung an den Empfänger.",
	"Couldn't copy. The link is {link}": "Kopieren fehlgeschlagen. Der Link lautet {link}",
	"Requested by": "Angefragt von",
	"Discussion:": "Diskussion:",
	"Secure handover: approved and set aside, paid out once both sides confirm.":
		"Sichere Übergabe: freigegeben und zurückgelegt, ausgezahlt, sobald beide Seiten bestätigen.",
	"Confirm release": "Auszahlung bestätigen",
	"Copy link for the recipient": "Link für den Empfänger kopieren",
	"Simulate recipient confirmation": "Bestätigung des Empfängers simulieren",
	"Cancel handover": "Übergabe abbrechen",
	"Apply now": "Jetzt anwenden",
	"Send now": "Jetzt senden",
	Approve: "Freigeben",
	"Add security seal": "Sicherheitssiegel hinzufügen",
	"Security seal": "Sicherheitssiegel",
	"Goes out": "Geht raus",
	"unless someone objects": "sofern niemand widerspricht",
	Cancelled: "Abgebrochen",
	Declined: "Abgelehnt",
	by: "von",
	"Waiting for approval": "Wartet auf Freigabe",
	"Ready to go out": "Bereit zur Auszahlung",
	Failed: "Fehlgeschlagen",
	"Held until both confirm": "Zurückgehalten, bis beide bestätigen",
	"ECB reference rate": "EZB-Referenzkurs",
	" Payments come from the organization's contract, deposits from the Stellar ledger as far back as this device has read them; every transaction is on stellar.expert.":
		" Zahlungen stammen aus dem Vertrag der Organisation, Einzahlungen aus dem Stellar-Ledger, so weit zurück, wie dieses Gerät sie gelesen hat; jede Transaktion steht auf stellar.expert.",
	"Strictest tier (membership or rule change)":
		"Strengste Stufe (Mitgliedschaft oder Regeländerung)",
	"{available} available · {waiting} waiting in requests":
		"{available} verfügbar · {waiting} in Anfragen gebunden",
	"Earns in a DeFindex vault on Stellar testnet (Blend lending, variable).":
		"Erwirtschaftet Erträge in einem DeFindex-Tresor im Stellar-Testnet (Blend-Kredite, variabel).",
	"Waiting for the anchor…": "Warte auf den Anchor…",
	"Received from the issuer": "Vom Herausgeber erhalten",
	"Moved to the Reserve": "In die Reserve verschoben",
	"Moved from the Reserve": "Aus der Reserve verschoben",
	"Reserve earnings (variable)": "Erträge der Reserve (variabel)",
	"Logo updated": "Logo aktualisiert",
	"{amount} {asset} ≈ {converted} at {rate}": "{amount} {asset} ≈ {converted} zu {rate}",
	" and ": " und ",
	"total {amount}": "gesamt {amount}",
	"; payments in another currency take the strictest tier":
		"; Zahlungen in einer anderen Währung nehmen die strengste Stufe",
	"Blend lending on testnet, variable": "Blend-Kredite im Testnet, variabel",
	"US dollar": "US-Dollar",
	"Finish the anchor's form in the window that opened.":
		"Füllen Sie das Formular des Anchors im geöffneten Fenster aus.",
	"The anchor is waiting for your bank transfer.": "Der Anchor wartet auf Ihre Banküberweisung.",
	"The anchor is ready: it now expects the organization's payment.":
		"Der Anchor ist bereit: Er erwartet jetzt die Zahlung der Organisation.",
	"The anchor received the money and is finishing up.":
		"Der Anchor hat das Geld erhalten und schließt ab.",
	"The anchor is paying out to the bank account.": "Der Anchor zahlt auf das Bankkonto aus.",
	"Done: the anchor paid the bank account.": "Erledigt: Der Anchor hat auf das Bankkonto gezahlt.",
	"The anchor refunded this transaction.": "Der Anchor hat diese Transaktion erstattet.",
	"This transaction expired at the anchor. Start again.":
		"Diese Transaktion ist beim Anchor abgelaufen. Beginnen Sie neu.",
	"The anchor reported an error.": "Der Anchor hat einen Fehler gemeldet.",
	"Enter the recipient's Stellar address.": "Geben Sie die Stellar-Adresse des Empfängers ein.",
	"Enter the recipient's IBAN.": "Geben Sie die IBAN des Empfängers ein.",
	"{amount} available": "{amount} verfügbar",
	" · recipient can't receive it": " · Empfänger kann es nicht empfangen",
	"the chosen asset": "die gewählte Währung",
	" · new recipient": " · neuer Empfänger",
	" · over budget": " · über Budget",
	"not yet": "noch nicht",
	Simulated: "Simuliert",
	"Sample data, not on the Stellar testnet": "Beispieldaten, nicht im Stellar-Testnet",
	"Download statement (CSV)": "Auszug herunterladen (CSV)",
	Requests: "Anfragen",
	"Audits run on the Stellar testnet. Sign in with your pass there.":
		"Prüfungen laufen im Stellar-Testnet. Melden Sie sich dort mit Ihrem Pass an.",
	"Enter the organization's account address (starts with C).":
		"Geben Sie die Kontoadresse der Organisation ein (beginnt mit C).",
	"Read an organization's requests and recipients as its auditor. Its members add you and share access; you can't change anything.":
		"Lesen Sie als Prüfer die Anfragen und Empfänger einer Organisation. Ihre Mitglieder fügen Sie hinzu und teilen den Zugang; Sie können nichts ändern.",
	"Your part": "Ihr Teil",
	"Give the organization your ancora ID,": "Geben Sie der Organisation Ihre ancora-ID,",
	", and set up this device so they can share their key with you.":
		", und richten Sie dieses Gerät ein, damit sie ihren Schlüssel mit Ihnen teilen kann.",
	"Set up private details on this device": "Vertrauliche Angaben auf diesem Gerät einrichten",
	"This device is set up. The organization can now share access with you.":
		"Dieses Gerät ist eingerichtet. Die Organisation kann den Zugang jetzt mit Ihnen teilen.",
	"Set up this device": "Dieses Gerät einrichten",
	"Open an organization": "Organisation öffnen",
	"Organization address": "Adresse der Organisation",
	"Open read-only": "Nur lesend öffnen",
	"Deal #{id}": "Vereinbarung #{id}",
	"Reading the deal…": "Vereinbarung wird gelesen…",
	"This organization takes no part in deal #":
		"Diese Organisation ist nicht beteiligt an Vereinbarung #",
	"All deals": "Alle Vereinbarungen",
	"Paid out.": "Ausgezahlt.",
	"Approval requested: it goes out once your organization's rules are met.":
		"Freigabe angefragt: Es geht raus, sobald die Regeln Ihrer Organisation erfüllt sind.",
	"You pay": "Sie zahlen",
	"You are paid by": "Sie werden bezahlt von",
	"Time to object": "Einspruchsfrist",
	"days per payout": "Tage pro Auszahlung",
	Arbiter: "Schlichter",
	"None (disputes aren't possible)": "Keiner (Streitfälle sind nicht möglich)",
	"Agreement fingerprint": "Fingerabdruck der Vereinbarung",
	Cancellation: "Stornierung",
	"asked to cancel; the other side has to agree.":
		"hat die Stornierung beantragt; die andere Seite muss zustimmen.",
	"Deal contract": "Vertrag der Vereinbarungen",
	Milestones: "Meilensteine",
	" · due for payout": " · zur Auszahlung fällig",
	"Awaiting internal approval": "Wartet auf interne Freigabe",
	"Approved; objection window running": "Freigegeben; Einspruchsfrist läuft",
	"Approval requested": "Freigabe angefragt",
	"What you can do": "Was Sie tun können",
	"Nothing for you to do right now.": "Gerade gibt es für Sie nichts zu tun.",
	"Each step goes through your organization's approval rules, like a payment.":
		"Jeder Schritt läuft wie eine Zahlung über die Freigaberegeln Ihrer Organisation.",
	"Settle work with another organization step by step: the amount is deposited up front and paid out milestone by milestone, each side under its own approval rules.":
		"Rechnen Sie Arbeit mit einer anderen Organisation Schritt für Schritt ab: Der Betrag wird vorab hinterlegt und Meilenstein für Meilenstein ausgezahlt, jede Seite nach ihren eigenen Freigaberegeln.",
	"Deals run on the Stellar testnet. Switch to the testnet on your pass to start one.":
		"Vereinbarungen laufen im Stellar-Testnet. Wechseln Sie in Ihrem Pass zum Testnet, um eine zu beginnen.",
	"This organization runs an earlier release. Move to the latest release under Settings → Organization code to start deals (organizations from before 1 Nov 2026 can't).":
		"Diese Organisation läuft mit einer älteren Version. Wechseln Sie unter Einstellungen → Code der Organisation zur neuesten Version, um Vereinbarungen zu beginnen (Organisationen von vor dem 1. Nov. 2026 können es nicht).",
	"Your deals": "Ihre Vereinbarungen",
	"Reading your deals…": "Ihre Vereinbarungen werden gelesen…",
	"No deals yet. Propose one above.": "Noch keine Vereinbarungen. Schlagen Sie oben eine vor.",
	"· since": "· seit",
	"Enter the other organization's account address (starts with C or G).":
		"Geben Sie die Kontoadresse der anderen Organisation ein (beginnt mit C oder G).",
	"Every milestone needs a name and an amount above zero.":
		"Jeder Meilenstein braucht einen Namen und einen Betrag über null.",
	"The time to object is between one minute and 90 days.":
		"Die Einspruchsfrist liegt zwischen einer Minute und 90 Tagen.",
	"The arbiter needs a Stellar account address, or leave it empty.":
		"Der Schlichter braucht eine Stellar-Kontoadresse, oder lassen Sie das Feld leer.",
	"Attach the agreement; only its fingerprint is recorded, the file stays with you.":
		"Hängen Sie die Vereinbarung an; nur ihr Fingerabdruck wird festgehalten, die Datei bleibt bei Ihnen.",
	"Propose a deal of {amount}": "Vereinbarung über {amount} vorschlagen",
	"Deal proposed. The other side can now accept the terms.":
		"Vereinbarung vorgeschlagen. Die andere Seite kann die Bedingungen jetzt annehmen.",
	"Approval requested: the deal goes out once your rules are met.":
		"Freigabe angefragt: Die Vereinbarung geht raus, sobald Ihre Regeln erfüllt sind.",
	"Propose a deal": "Vereinbarung vorschlagen",
	"Other organization": "Andere Organisation",
	"Their account address, from their Settings. ancora names come later.":
		"Ihre Kontoadresse, aus ihren Einstellungen. ancora-Namen kommen später.",
	"Paid in": "Bezahlt in",
	"Milestone {number}": "Meilenstein {number}",
	"Design delivered": "Entwurf geliefert",
	"Add a milestone": "Meilenstein hinzufügen",
	"Remove the last": "Letzten entfernen",
	"Days to object": "Tage für Einspruch",
	"After the other side asks for a payout, you have this long to object; then it pays out automatically.":
		"Nachdem die andere Seite eine Auszahlung anfragt, haben Sie so lange Zeit für einen Einspruch; danach wird automatisch ausgezahlt.",
	"Arbiter (optional)": "Schlichter (optional)",
	"Someone both sides trust to split what is left if you disagree. Without one, disputes aren't possible.":
		"Eine Person, der beide Seiten vertrauen und die bei Uneinigkeit den Rest aufteilt. Ohne Schlichter sind Streitfälle nicht möglich.",
	"C… or G…": "C… oder G…",
	Agreement: "Vereinbarung",
	"Only the file's fingerprint is recorded; the file itself stays with you.":
		"Nur der Fingerabdruck der Datei wird festgehalten; die Datei selbst bleibt bei Ihnen.",
	"Propose the deal": "Vereinbarung vorschlagen",
	"Question posted.": "Frage gestellt.",
	"Marked as answered.": "Als beantwortet markiert.",
	Discussion: "Diskussion",
	"Reasons for and against, questions and comments help approvers decide. Taking part here doesn't count as an approval.":
		"Gründe dafür und dagegen, Fragen und Kommentare helfen bei der Entscheidung. Hier mitzureden zählt nicht als Freigabe.",
	" · answered": " · beantwortet",
	" · open": " · offen",
	"Thumbs up": "Daumen hoch",
	"Thumbs down": "Daumen runter",
	"Mark as answered": "Als beantwortet markieren",
	Kind: "Art",
	"Your question": "Ihre Frage",
	"Your point": "Ihr Beitrag",
	"Up to {count} characters. Visible to the organization's members.":
		"Bis zu {count} Zeichen. Sichtbar für die Mitglieder der Organisation.",
	Post: "Veröffentlichen",
	"Only members of the organization can take part.":
		"Nur Mitglieder der Organisation können mitreden.",
	"Confirm the secure handover": "Sichere Übergabe bestätigen",
	"Confirmed. The money goes out as soon as the organization confirms too.":
		"Bestätigt. Das Geld geht raus, sobald auch die Organisation bestätigt.",
	"Secure handover": "Sichere Übergabe",
	"Not found": "Nicht gefunden",
	"Back to the overview": "Zurück zur Übersicht",
	"{amount} from {organization}": "{amount} von {organization}",
	"Recipient confirmed": "Empfänger hat bestätigt",
	"Not yet": "Noch nicht",
	"Organization confirmed": "Organisation hat bestätigt",
	Status: "Status",
	"Paid out": "Ausgezahlt",
	"Confirm: I'm the recipient and the terms are right":
		"Bestätigen: Ich bin der Empfänger, und die Bedingungen stimmen",
	"Only the recipient's pass (": "Nur der Pass des Empfängers (",
	") can confirm here. Open this link signed in with that pass.":
		") kann hier bestätigen. Öffnen Sie diesen Link, angemeldet mit diesem Pass.",
	"Install the app": "App installieren",
	"To install: tap": "Zum Installieren: Tippen Sie auf",
	Share: "Teilen",
	", then": ", dann auf",
	"Add to Home Screen": "Zum Home-Bildschirm",
	"The claim is cancelled. Your pass stays as it is.":
		"Der Anspruch ist zurückgezogen. Ihr Pass bleibt, wie er ist.",
	"Recovery of your pass started": "Wiederherstellung Ihres Passes begonnen",
	"Cancel it": "Abbrechen",
	Details: "Details",
	"People you protect": "Personen, die Sie schützen",
	"They named you as a guardian. If one of them loses their pass, they create a new one and tell you its ID; you confirm it here. Verify in person or by voice that it is really them: a guardian's confirmation is what makes a recovery possible.":
		"Sie wurden als Vertrauensperson benannt. Verliert jemand davon den Pass, erstellt die Person einen neuen und nennt Ihnen dessen ID; Sie bestätigen ihn hier. Prüfen Sie persönlich oder am Telefon, dass es wirklich die Person ist: Erst die Bestätigung der Vertrauenspersonen macht eine Wiederherstellung möglich.",
	"Recovery of {name}'s pass started; your confirmation counts.":
		"Wiederherstellung des Passes von {name} begonnen; Ihre Bestätigung zählt.",
	"You confirmed {name}'s new pass.": "Sie haben den neuen Pass von {name} bestätigt.",
	"Confirm this new pass": "Diesen neuen Pass bestätigen",
	"{name}'s new ancora ID": "Neue ancora-ID von {name}",
	"Ask them to read it from their new pass (starts with C). Check it's really them.":
		"Lassen Sie sie von ihrem neuen Pass vorlesen (beginnt mit C). Prüfen Sie, dass es wirklich die Person ist.",
	"Start recovery": "Wiederherstellung beginnen",
	"They lost their pass": "Pass verloren",
	"Your recovery plan is removed.": "Ihr Wiederherstellungsplan ist entfernt.",
	Lifeline: "Lifeline",
	"If you lose this pass, the guardians you name here can confirm a new one. After the waiting period your positions in every organization move to it. Recovery never moves money, and while a claim waits you can cancel it from this pass.":
		"Wenn Sie diesen Pass verlieren, können die hier benannten Vertrauenspersonen einen neuen bestätigen. Nach der Wartezeit gehen Ihre Positionen in jeder Organisation auf ihn über. Eine Wiederherstellung bewegt nie Geld, und solange ein Anspruch wartet, können Sie ihn von diesem Pass aus abbrechen.",
	Protected: "Geschützt",
	"Not protected yet": "Noch nicht geschützt",
	"This pass is the only key to your positions. Name guardians.":
		"Dieser Pass ist der einzige Schlüssel zu Ihren Positionen. Benennen Sie Vertrauenspersonen.",
	"Someone is recovering your pass.": "Jemand stellt Ihren Pass wieder her.",
	"Cancel this claim": "Diesen Anspruch abbrechen",
	"Change plan": "Plan ändern",
	"Set up Lifeline": "Lifeline einrichten",
	"Remove plan": "Plan entfernen",
	"Your recovery plan is saved.": "Ihr Wiederherstellungsplan ist gespeichert.",
	Remove: "Entfernen",
	"Add a guardian by ancora ID": "Vertrauensperson per ancora-ID hinzufügen",
	"Anyone with an ancora pass, also outside your organizations.":
		"Jede Person mit einem ancora-Pass, auch außerhalb Ihrer Organisationen.",
	"Confirmations needed": "Nötige Bestätigungen",
	"Waiting period": "Wartezeit",
	"Time you have to cancel a claim that isn't yours.":
		"Die Zeit, die Sie haben, um einen fremden Anspruch abzubrechen.",
	"Save plan": "Plan speichern",
	"Your positions moved to this pass.": "Ihre Positionen sind auf diesen Pass übergegangen.",
	"Recover an old pass": "Alten Pass wiederherstellen",
	"Lost your previous pass? Give its ancora ID to the guardians you had named; they confirm this new pass (":
		"Ihren bisherigen Pass verloren? Nennen Sie seine ancora-ID den Vertrauenspersonen, die Sie benannt hatten; sie bestätigen diesen neuen Pass (",
	"). Once enough have confirmed and the waiting period is over, complete the recovery here: your positions in every organization move to this pass.":
		"). Sobald genug bestätigt haben und die Wartezeit vorbei ist, schließen Sie die Wiederherstellung hier ab: Ihre Positionen in jeder Organisation gehen auf diesen Pass über.",
	"Old ancora ID": "Alte ancora-ID",
	"Check status": "Status prüfen",
	"Hand over remaining positions": "Restliche Positionen übergeben",
	"Complete recovery": "Wiederherstellung abschließen",
	"Handed over in": "Übergeben in",
	organization: "Organisation",
	"Ask for money: invoices and membership fees anyone pays from their own wallet.":
		"Geld anfordern: Rechnungen und Mitgliedsbeiträge, die jede Person aus der eigenen Wallet bezahlt.",
	"This organization was created before payment links existed; organizations created from 28 Oct 2026 can ask for money with a link.":
		"Diese Organisation wurde vor den Zahlungslinks gegründet; ab dem 28. Okt. 2026 gegründete Organisationen können Geld per Link anfordern.",
	"Enter an amount like 30 or 120.50.": "Geben Sie einen Betrag wie 30 oder 120,50 ein.",
	"A link takes one to 500 payments.": "Ein Link nimmt eine bis 500 Zahlungen an.",
	"Say what it's for, like Membership 2027 or Invoice 14.":
		"Geben Sie den Zweck an, etwa Mitgliedschaft 2027 oder Rechnung 14.",
	"Create a payment link: {reference}": "Zahlungslink erstellen: {reference}",
	"Payment link created. Copy it or show its QR code below.":
		"Zahlungslink erstellt. Kopieren Sie ihn oder zeigen Sie unten seinen QR-Code.",
	"Link copied. Send it to whoever should pay.":
		"Link kopiert. Senden Sie ihn an die Person, die zahlen soll.",
	"Couldn't copy. Open the QR code and share that instead.":
		"Kopieren fehlgeschlagen. Öffnen Sie den QR-Code und teilen Sie stattdessen diesen.",
	"Ask for money": "Geld anfordern",
	"What it's for": "Wofür",
	"Membership 2027": "Mitgliedschaft 2027",
	"Paid by": "Bezahlt von",
	"One payer (invoice)": "Eine zahlende Person (Rechnung)",
	"Several people (fees)": "Mehrere Personen (Beiträge)",
	"At most": "Höchstens",
	"Each wallet pays once; the link closes when this many have paid.":
		"Jede Wallet zahlt einmal; der Link schließt, wenn so viele bezahlt haben.",
	"Create link": "Link erstellen",
	Links: "Links",
	"No payment links yet.": "Noch keine Zahlungslinks.",
	Paid: "Bezahlt",
	"· total": "· gesamt",
	"· created": "· erstellt",
	"Copy link": "Link kopieren",
	"QR code": "QR-Code",
	"Close the link {reference}": "Link {reference} schließen",
	"Link closed. It takes no more payments.": "Link geschlossen. Er nimmt keine Zahlungen mehr an.",
	Close: "Schließen",
	"Sample data: payers open links of organizations on the Stellar testnet.":
		"Beispieldaten: Zahlende öffnen Links von Organisationen im Stellar-Testnet.",
	"QR code for the payment link {reference}": "QR-Code für den Zahlungslink {reference}",
	"Reading the payment link from Stellar…": "Zahlungslink wird von Stellar gelesen…",
	"asks for": "bittet um",
	"of up to": "von bis zu",
	"people.": "Personen.",
	"Paid. Thank you.": "Bezahlt. Vielen Dank.",
	"sees your payment now.": "sieht Ihre Zahlung jetzt.",
	"View the transaction": "Transaktion ansehen",
	"This link is closed or fully paid. Nothing to pay here.":
		"Dieser Link ist geschlossen oder vollständig bezahlt. Hier gibt es nichts zu zahlen.",
	From: "Von",
	Pay: "Zahlen",
	"Pay with a Stellar wallet": "Mit einer Stellar-Wallet zahlen",
	"Freighter, xBull, Hana or Albedo on the Stellar testnet. Your wallet needs some XLM for the fee and a trustline for":
		"Freighter, xBull, Hana oder Albedo im Stellar-Testnet. Ihre Wallet braucht etwas XLM für die Gebühr und eine Trustline für",
	". Test money only; nothing real moves.": ". Nur Testgeld; nichts Echtes bewegt sich.",
	"Payments go straight to": "Zahlungen gehen direkt auf das Konto von",
	"the organization": "der Organisation",
	"'s account on Stellar. ancora is not a bank and never holds the money.":
		" auf Stellar. ancora ist keine Bank und verwahrt das Geld nie.",
	"Give your organization a name.": "Geben Sie Ihrer Organisation einen Namen.",
	"Pick at least one asset the organization accepts.":
		"Wählen Sie mindestens eine Währung, die die Organisation annimmt.",
	"Create {name}": "{name} gründen",
	"Organization created on Stellar. Invite your people by their ancora ID next.":
		"Organisation auf Stellar gegründet. Laden Sie als Nächstes Ihre Leute über ihre ancora-ID ein.",
	"Organization created. Add your people next.":
		"Organisation gegründet. Fügen Sie als Nächstes Ihre Leute hinzu.",
	"Deploys the organization's own contract on Stellar testnet with you as its founder. Fees are sponsored; no signature needed for this step.":
		"Legt den eigenen Vertrag der Organisation im Stellar-Testnet an, mit Ihnen als Gründer. Die Gebühren werden übernommen; für diesen Schritt ist keine Signatur nötig.",
	"An account with your own approval rules, in a minute.":
		"Ein Konto mit Ihren eigenen Freigaberegeln, in einer Minute.",
	Template: "Vorlage",
	Above: "Darüber",
	"Up to {amount}": "Bis {amount}",
	"{hours}h objection window": "{hours} Std. Einspruchsfrist",
	"Security seal from": "Sicherheitssiegel ab",
	Money: "Geld",
	"Currency of the rules": "Währung der Regeln",
	"The tiers above are in this currency. Payments in an accepted asset of another currency take the strictest tier.":
		"Die Stufen oben gelten in dieser Währung. Zahlungen in einer angenommenen Währung einer anderen Landeswährung nehmen die strengste Stufe.",
	"Accepted stablecoins": "Angenommene Stablecoins",
	"Your role": "Ihre Rolle",
	"You can add people and adjust the rules right after.":
		"Sie können gleich danach Personen hinzufügen und die Regeln anpassen.",
	"Confirm with your passkey": "Mit Ihrem Passkey bestätigen",
	"Your passkey confirms the seal; organizations that require quantum-safe seals also sign it with the key on this device.":
		"Ihr Passkey bestätigt das Siegel; Organisationen, die quantensichere Siegel verlangen, signieren es zusätzlich mit dem Schlüssel auf diesem Gerät.",
	"Use Face ID, your fingerprint or your device PIN.":
		"Nutzen Sie Face ID, Ihren Fingerabdruck oder die PIN Ihres Geräts.",
	"Simulated signature": "Simulierte Signatur",
	"Sign with seal": "Mit Siegel signieren",
	"The people and companies your organization pays.":
		"Die Personen und Unternehmen, die Ihre Organisation bezahlt.",
	"Give the recipient a name.": "Geben Sie dem Empfänger einen Namen.",
	"Enter a Stellar address.": "Geben Sie eine Stellar-Adresse ein.",
	"Enter an IBAN.": "Geben Sie eine IBAN ein.",
	"Remove {name} from the address book": "{name} aus dem Adressbuch entfernen",
	"{name} was removed from the address book.": "{name} wurde aus dem Adressbuch entfernt.",
	" · not paid yet": " · noch nicht bezahlt",
	"Saved recipients": "Gespeicherte Empfänger",
	'Nobody saved yet. Save a recipient below, or tick "Save to the address book" when you pay someone new; every member then sees the same name for that address.':
		"Noch niemand gespeichert. Speichern Sie unten einen Empfänger, oder setzen Sie bei einer Zahlung an jemand Neues das Häkchen „Im Adressbuch speichern“; jedes Mitglied sieht dann denselben Namen für diese Adresse.",
	"Paid before, not saved": "Schon bezahlt, nicht gespeichert",
	"Save a recipient": "Empfänger speichern",
	"Starts with G or C.": "Beginnt mit G oder C.",
	Note: "Notiz",
	"Optional, shown to every member.": "Optional, für jedes Mitglied sichtbar.",
	"Save changes": "Änderungen speichern",
	"Save recipient": "Empfänger speichern",
	"Save recipients": "Empfänger speichern",
	"This organization was created before the address book existed; organizations created from 28 Oct 2026 keep saved recipients on their contract for every member.":
		"Diese Organisation wurde vor dem Adressbuch gegründet; ab dem 28. Okt. 2026 gegründete Organisationen speichern Empfänger in ihrem Vertrag für jedes Mitglied.",
	"Enter an amount above zero.": "Geben Sie einen Betrag über null ein.",
	"At most {amount}.": "Höchstens {amount}.",
	"Enter the other organization's account address (starts with C).":
		"Geben Sie die Kontoadresse der anderen Organisation ein (beginnt mit C).",
	"Their organization's address": "Adresse ihrer Organisation",
	"Working on it…": "Wird bearbeitet…",
	"Requested. It goes once your rules are met (see Approvals).":
		"Angefragt. Es geht raus, sobald Ihre Regeln erfüllt sind (siehe Freigaben).",
	"Money in the pot is held by a Stellar contract that hides its balance and the amounts paid between pots. Your members read them on their devices; who pays whom, and what moves in or out, stays public.":
		"Das Geld in der Kasse verwahrt ein Stellar-Vertrag, der ihren Saldo und die Beträge zwischen Kassen verbirgt. Ihre Mitglieder lesen sie auf ihren Geräten; wer wen bezahlt und was ein- oder ausgeht, bleibt öffentlich.",
	"The pot runs on the Stellar testnet. Switch to the testnet on your pass to use it.":
		"Die Kasse läuft im Stellar-Testnet. Wechseln Sie in Ihrem Pass zum Testnet, um sie zu nutzen.",
	Preview: "Vorschau",
	"A testnet preview, not audited": "Eine Vorschau im Testnet, nicht geprüft",
	"A preview on the testnet: the proofs follow OpenZeppelin's confidential token, whose recipe is still provisional, and nothing here has been audited. Each step that moves money is a request under your organization's rules; a payment's amount can't be seen by the contract, so it always takes your strictest approvals.":
		"Eine Vorschau im Testnet: Die Beweise folgen dem vertraulichen Token von OpenZeppelin, dessen Verfahren noch vorläufig ist, und nichts hier wurde geprüft. Jeder Schritt, der Geld bewegt, ist eine Anfrage nach den Regeln Ihrer Organisation; den Betrag einer Zahlung sieht der Vertrag nicht, daher nimmt sie immer Ihre strengsten Freigaben.",
	"Reading the pot…": "Kasse wird gelesen…",
	"Pot contract": "Vertrag der Kasse",
	"The pot holds the test USDC. Accept it under Rules → Accounts to use the pot.":
		"Die Kasse hält die Test-USDC. Nehmen Sie sie unter Regeln → Konten an, um die Kasse zu nutzen.",
	"Opening the pot creates its key (kept with your private details, so every member's device reads it), proves it on this device, and asks your organization to open its pot account. Your passkey is asked a few times.":
		"Das Öffnen der Kasse erstellt ihren Schlüssel (gespeichert bei Ihren vertraulichen Angaben, sodass das Gerät jedes Mitglieds ihn liest), beweist ihn auf diesem Gerät und bittet Ihre Organisation, ihr Kassenkonto zu eröffnen. Ihr Passkey wird einige Male abgefragt.",
	"The pot key exists; opening the account waits for your rules (see Approvals). If that request was declined, ask again.":
		"Der Kassenschlüssel existiert; das Eröffnen des Kontos wartet auf Ihre Regeln (siehe Freigaben). Wurde die Anfrage abgelehnt, fragen Sie erneut an.",
	"Open the pot": "Kasse öffnen",
	"Ask again": "Erneut anfragen",
	"The pot is open, but the history the network keeps (about a week) doesn't reach back far enough to read its balance on this device. Its money is safe; the next payment out or in-and-merge will make it readable again.":
		"Die Kasse ist offen, aber der Verlauf, den das Netzwerk aufbewahrt (etwa eine Woche), reicht nicht weit genug zurück, um ihren Saldo auf diesem Gerät zu lesen. Das Geld ist sicher; die nächste Auszahlung oder ein Eingang mit Zusammenführung macht ihn wieder lesbar.",
	"Spendable in the pot": "In der Kasse verfügbar",
	"A pot payment is waiting for approval. Until it runs, new payments and making incoming money spendable are paused: they would change the balance its proof was made for.":
		"Eine Zahlung aus der Kasse wartet auf Freigabe. Bis sie läuft, sind neue Zahlungen und das Verfügbarmachen von Eingängen pausiert: Sie würden den Saldo ändern, für den ihr Beweis erstellt wurde.",
	"The incoming money is spendable now.": "Die Eingänge sind jetzt verfügbar.",
	"Make it spendable": "Verfügbar machen",
	"Move money in": "Geld einzahlen",
	"From the account into the pot. The amount is public; what happens to it in the pot isn't.":
		"Vom Konto in die Kasse. Der Betrag ist öffentlich; was in der Kasse damit geschieht, nicht.",
	"Pay another organization": "Andere Organisation bezahlen",
	"To their pot. Only your two organizations read the amount. The proof is made on this device and takes a few seconds.":
		"In deren Kasse. Nur Ihre beiden Organisationen lesen den Betrag. Der Beweis wird auf diesem Gerät erstellt und dauert einige Sekunden.",
	"Take money out": "Geld auszahlen",
	"Back to the account; the amount becomes public.":
		"Zurück aufs Konto; der Betrag wird öffentlich.",
	"Nothing yet in the last week.": "In der letzten Woche noch nichts.",
	"this organization": "diese Organisation",
	"Amount (private on the network):": "Betrag (im Netzwerk vertraulich):",
	"Show the amount": "Betrag anzeigen",
	"There are no keys on this device yet.": "Auf diesem Gerät gibt es noch keine Schlüssel.",
	"Backup code copied. Keep it like a password.":
		"Sicherungscode kopiert. Bewahren Sie ihn wie ein Passwort auf.",
	"Couldn't copy; select the code and copy it by hand.":
		"Kopieren fehlgeschlagen; markieren Sie den Code und kopieren Sie ihn von Hand.",
	"Bring back your keys with your passkey": "Ihre Schlüssel mit Ihrem Passkey zurückholen",
	"This passkey or browser can't make keys. Use your backup code instead.":
		"Dieser Passkey oder Browser kann keine Schlüssel erzeugen. Nutzen Sie stattdessen Ihren Sicherungscode.",
	"Your keys weren't made with this passkey (they were set up before, or with another one). Use your backup code instead.":
		"Ihre Schlüssel wurden nicht mit diesem Passkey erzeugt (sie wurden früher oder mit einem anderen eingerichtet). Nutzen Sie stattdessen Ihren Sicherungscode.",
	"Keys on this device": "Schlüssel auf diesem Gerät",
	"Your key for private details and your quantum-safe seal key live only in this browser. Where your passkey supports it, they are made from your passkey, so a device your passkey syncs to gets them back with it. A backup code works everywhere. It can't move money (that always needs your passkey), but it reads your organizations' private details: keep it like a password.":
		"Ihr Schlüssel für vertrauliche Angaben und Ihr quantensicherer Siegelschlüssel liegen nur in diesem Browser. Wo Ihr Passkey es unterstützt, werden sie aus Ihrem Passkey erzeugt, sodass ein Gerät, auf das Ihr Passkey synchronisiert wird, sie damit zurückbekommt. Ein Sicherungscode funktioniert überall. Er kann kein Geld bewegen (dafür braucht es immer Ihren Passkey), liest aber die vertraulichen Angaben Ihrer Organisationen: Bewahren Sie ihn wie ein Passwort auf.",
	"Bring back with my passkey": "Mit meinem Passkey zurückholen",
	"Copy backup code": "Sicherungscode kopieren",
	"Show backup code": "Sicherungscode anzeigen",
	"Restore from a backup code": "Aus einem Sicherungscode wiederherstellen",
	"ancora-keys-1.…": "ancora-keys-1.…",
	"Restore keys": "Schlüssel wiederherstellen",
	"Private details read again on this device.":
		"Vertrauliche Angaben sind auf diesem Gerät wieder lesbar.",
	"Quantum-safe seals sign again on this device.":
		"Quantensichere Siegel signieren auf diesem Gerät wieder.",
	"Second passkey": "Zweiter Passkey",
	"The new passkey can now sign for your account.":
		"Der neue Passkey kann jetzt für Ihr Konto signieren.",
	Devices: "Geräte",
	passkeys: "Passkeys",
	"can sign for this account.": "können für dieses Konto signieren.",
	"One passkey": "Ein Passkey",
	": if this device is lost, only Lifeline can get your positions back. Add a second one.":
		": Geht dieses Gerät verloren, kann nur Lifeline Ihre Positionen zurückholen. Fügen Sie einen zweiten hinzu.",
	"Name of the new passkey": "Name des neuen Passkeys",
	"Your browser then asks where to create it: a security key, this device, or another phone by QR code.":
		"Ihr Browser fragt dann, wo er erstellt werden soll: auf einem Sicherheitsschlüssel, diesem Gerät oder per QR-Code auf einem anderen Telefon.",
	"YubiKey, old phone…": "YubiKey, altes Telefon…",
	"Waiting for the passkey…": "Warte auf den Passkey…",
	"Create and add": "Erstellen und hinzufügen",
	"Add a passkey": "Passkey hinzufügen",
	"Profile saved on Stellar. Every organization sees it.":
		"Profil auf Stellar gespeichert. Jede Organisation sieht es.",
	"Your profile": "Ihr Profil",
	"Change picture": "Bild ändern",
	"Add picture": "Bild hinzufügen",
	"Remove picture": "Bild entfernen",
	"PNG, JPG or WebP. Cropped to a 256×256 square in your browser.":
		"PNG, JPG oder WebP. In Ihrem Browser auf ein Quadrat von 256×256 zugeschnitten.",
	"Up to 64 characters.": "Bis zu 64 Zeichen.",
	"Save profile": "Profil speichern",
	"Notifications are off.": "Benachrichtigungen sind aus.",
	"Notifications are on.": "Benachrichtigungen sind an.",
	Notifications: "Benachrichtigungen",
	"ancora tells this device when a payment or change waits for your approval, when your request went through or was declined, and when a guardian starts recovering your pass.":
		"ancora benachrichtigt dieses Gerät, wenn eine Zahlung oder Änderung auf Ihre Freigabe wartet, wenn Ihre Anfrage durchging oder abgelehnt wurde und wenn eine Vertrauensperson beginnt, Ihren Pass wiederherzustellen.",
	"Turn off on this device": "Auf diesem Gerät ausschalten",
	"Turn on for this device": "Für dieses Gerät einschalten",
	"Your ancora ID is copied. Share it to get invited.":
		"Ihre ancora-ID ist kopiert. Teilen Sie sie, um eingeladen zu werden.",
	"Couldn't copy. Select the ID and copy it by hand.":
		"Kopieren fehlgeschlagen. Markieren Sie die ID und kopieren Sie sie von Hand.",
	"Your ancora pass": "Ihr ancora-Pass",
	"ancora pass": "ancora-Pass",
	"Account on Stellar, secured by your passkey": "Konto auf Stellar, gesichert durch Ihren Passkey",
	"Sample person": "Beispielperson",
	"ancora ID": "ancora-ID",
	"Copy ID": "ID kopieren",
	"View on Stellar": "Auf Stellar ansehen",
	"QR code of the ancora ID {id}": "QR-Code der ancora-ID {id}",
	"Scan to invite": "Zum Einladen scannen",
	Positions: "Positionen",
	Login: "Anmeldung",
	Network: "Netzwerk",
	"Stellar testnet": "Stellar-Testnet",
	"Sample data": "Beispieldaten",
	You: "Sie",
	"One pass for every organization you work with.":
		"Ein Pass für jede Organisation, mit der Sie arbeiten.",
	"Viewing as": "Ansicht als",
	Demo: "Demo",
	Person: "Person",
	"Switch people to see the demo from their side. Signatures are simulated on sample data.":
		"Wechseln Sie die Person, um die Demo aus ihrer Sicht zu sehen. Signaturen sind bei Beispieldaten simuliert.",
	"Your positions": "Ihre Positionen",
	"No positions yet.": "Noch keine Positionen.",
	"Create an organization": "Organisation gründen",
	"or share your ancora ID with one that wants to invite you.":
		"oder teilen Sie Ihre ancora-ID mit einer Organisation, die Sie einladen möchte.",
	" · founder": " · Gründer",
	"Sign-in and recovery": "Anmeldung und Wiederherstellung",
	"Your passkey on this device. It signs every approval through your own account on Stellar; the private key never leaves the device.":
		"Ihr Passkey auf diesem Gerät. Er signiert jede Freigabe über Ihr eigenes Konto auf Stellar; der private Schlüssel verlässt das Gerät nie.",
	Recovery: "Wiederherstellung",
	"Protected by Lifeline": "Durch Lifeline geschützt",
	"guardians can confirm a new pass for you. Details below.":
		"Vertrauenspersonen können einen neuen Pass für Sie bestätigen. Details unten.",
	": this passkey is the only key to your positions. Name guardians in Lifeline below.":
		": Dieser Passkey ist der einzige Schlüssel zu Ihren Positionen. Benennen Sie unten in Lifeline Vertrauenspersonen.",
	"Sign out": "Abmelden",
	"Sign out to use another passkey on this device.":
		"Melden Sie sich ab, um auf diesem Gerät einen anderen Passkey zu nutzen.",
	"Sample data: signatures are simulated. Switch to the Stellar testnet below to sign in with a real passkey.":
		"Beispieldaten: Signaturen sind simuliert. Wechseln Sie unten zum Stellar-Testnet, um sich mit einem echten Passkey anzumelden.",
	Appearance: "Darstellung",
	Theme: "Design",
	System: "System",
	Light: "Hell",
	Dark: "Dunkel",
	"Expert mode": "Expertenmodus",
	"Show technical references (request IDs, rule tiers, on-chain links, the rules document).":
		"Technische Angaben anzeigen (Anfrage-IDs, Regelstufen, On-chain-Links, das Regeldokument).",
	"ancora works in any phone browser and can be added to your home screen. No app store needed.":
		"ancora funktioniert in jedem Browser auf dem Telefon und lässt sich zum Home-Bildschirm hinzufügen. Kein App Store nötig.",
	"an asset": "eine Währung",
	"Pick an asset or a budget category; the general allowance is under People & limits.":
		"Wählen Sie eine Währung oder eine Budgetkategorie; das allgemeine Kontingent finden Sie unter Personen & Limits.",
	"Enter an amount like 200 or 1,500.": "Geben Sie einen Betrag wie 200 oder 1.500 ein.",
	"Allowances by asset or category": "Kontingente nach Währung oder Kategorie",
	"Let someone pay up to an amount per period without approvals, only in one asset or only for one budget category. Recipients outside an allowlist never use an allowance.":
		"Lassen Sie jemanden bis zu einem Betrag pro Zeitraum ohne Freigabe zahlen, nur in einer Währung oder nur für eine Budgetkategorie. Empfänger außerhalb einer Freigabeliste nutzen nie ein Kontingent.",
	"Any, counted in": "Beliebig, gezählt in",
	Category: "Kategorie",
	Any: "Beliebig",
	Per: "Pro",
	"Set allowance": "Kontingent festlegen",
	"Accepted assets": "Angenommene Währungen",
	"Rules are in": "Die Regeln gelten in",
	". Payments in an asset of another currency take the strictest tier until a live exchange rate is connected.":
		". Zahlungen in einer Währung einer anderen Landeswährung nehmen die strengste Stufe, bis ein aktueller Wechselkurs verbunden ist.",
	" · earns in a Reserve": " · erwirtschaftet Erträge in einer Reserve",
	"Still holds money or has open requests": "Hält noch Geld oder hat offene Anfragen",
	"An organization needs at least one asset": "Eine Organisation braucht mindestens eine Währung",
	"Stop accepting": "Nicht mehr annehmen",
	"Accept another asset": "Weitere Währung annehmen",
	Accept: "Annehmen",
	"Accept any Stellar asset": "Beliebige Stellar-Währung annehmen",
	"A token contract address (C…) or a classic asset as CODE:ISSUER. The token itself says what it is; the organization's contract checks the same when it accepts it.":
		"Eine Token-Vertragsadresse (C…) oder ein klassisches Asset als CODE:HERAUSGEBER. Der Token sagt selbst, was er ist; der Vertrag der Organisation prüft dasselbe, wenn er ihn annimmt.",
	"C… or EURC:GB3Q…": "C… oder EURC:GB3Q…",
	"Stands for": "Steht für",
	EUR: "EUR",
	USD: "USD",
	"Reserve vault (optional)": "Tresor für die Reserve (optional)",
	"A DeFindex vault for this token, if one exists.":
		"Ein DeFindex-Tresor für diesen Token, falls es einen gibt.",
	Found: "Gefunden:",
	"decimals) at": "Dezimalstellen) bei",
	as: "als",
	"Asking the token…": "Token wird abgefragt…",
	"Name the category with letters or digits, like equipment or travel.":
		"Benennen Sie die Kategorie mit Buchstaben oder Ziffern, etwa ausruestung oder reisen.",
	"Envelopes per category and period, in": "Töpfe pro Kategorie und Zeitraum, in",
	". A payment tagged with the category counts against it. Beyond what is left, a":
		". Eine Zahlung mit dieser Kategorie zählt dagegen. Über den Rest hinaus schickt ein",
	soft: "weiches",
	"budget sends the payment through the strictest tier and flags it; a":
		"Budget die Zahlung über die strengste Stufe und markiert sie; ein",
	hard: "festes",
	"budget refuses it. Enforced by the organization's contract.":
		"Budget lehnt sie ab. Durchgesetzt vom Vertrag der Organisation.",
	"Beyond the budget": "Über das Budget hinaus",
	"Soft: strictest tier": "Weich: strengste Stufe",
	"Hard: refuse": "Fest: ablehnen",
	"Update budget": "Budget aktualisieren",
	"Add budget": "Budget hinzufügen",
	"Exchange rates": "Wechselkurse",
	"Payments in other currencies are judged at the live rate from Reflector, a price service on Stellar. Without a rate from the last four days they take the strictest approvals and the seal, so nothing is ever under-approved.":
		"Zahlungen in anderen Währungen werden zum aktuellen Kurs von Reflector bewertet, einem Preisdienst auf Stellar. Ohne einen Kurs aus den letzten vier Tagen nehmen sie die strengsten Freigaben und das Siegel, sodass nie etwas zu wenig freigegeben wird.",
	"All accepted assets are in": "Alle angenommenen Währungen lauten auf",
	"Stop using live rates": "Keine aktuellen Kurse mehr nutzen",
	"Today a payment in another currency than":
		"Heute nimmt eine Zahlung in einer anderen Währung als",
	"takes the strictest approvals and the seal. With live rates it is judged by its value in":
		"die strengsten Freigaben und das Siegel. Mit aktuellen Kursen wird sie nach ihrem Wert bewertet in",
	"Use live exchange rates": "Aktuelle Wechselkurse nutzen",
	People: "Personen",
	"Sample directory": "Beispielverzeichnis",
	"(you)": "(Sie)",
	"Role of {name}": "Rolle von {name}",
	"The organization needs at least one member who can approve its rules; the contract refuses this too.":
		"Die Organisation braucht mindestens ein Mitglied, das ihre Regeln freigeben kann; auch der Vertrag lehnt das ab.",
	"Invite by ancora ID": "Per ancora-ID einladen",
	"Ask the person for the ID on their pass (starts with C). An agent's key works the same way: add it as a member and give it a spending limit.":
		"Fragen Sie die Person nach der ID auf ihrem Pass (beginnt mit C). Der Schlüssel eines Agenten funktioniert genauso: Fügen Sie ihn als Mitglied hinzu und geben Sie ihm ein Ausgabelimit.",
	Invite: "Einladen",
	Role: "Rolle",
	"Add person": "Person hinzufügen",
	"Up to": "Bis zu",
	per: "pro",
	"Save limit": "Limit speichern",
	"Remove limit": "Limit entfernen",
	"Spending limit": "Ausgabelimit",
	"left; payments inside it need no approval.": "übrig; Zahlungen darin brauchen keine Freigabe.",
	"Set a limit": "Limit festlegen",
	Anyone: "Alle",
	"Others need the strictest approvals": "Andere brauchen die strengsten Freigaben",
	"Only the list": "Nur die Liste",
	"Enter a Stellar address (starts with G or C).":
		"Geben Sie eine Stellar-Adresse ein (beginnt mit G oder C).",
	"Who you pay": "Wen Sie bezahlen",
	"Keep payments to known recipients. Tick saved recipients from the address book or add an address; the list and the setting change together, as one rule change.":
		"Beschränken Sie Zahlungen auf bekannte Empfänger. Haken Sie gespeicherte Empfänger aus dem Adressbuch an oder fügen Sie eine Adresse hinzu; Liste und Einstellung ändern sich gemeinsam, als eine Regeländerung.",
	"No saved recipients yet; add an address below.":
		"Noch keine gespeicherten Empfänger; fügen Sie unten eine Adresse hinzu.",
	"Add an address": "Adresse hinzufügen",
	"G… or C…": "G… oder C…",
	"Add to the list": "Zur Liste hinzufügen",
	"Save who you pay": "Empfängerliste speichern",
	Roles: "Rollen",
	". This organization was created before custom roles existed; organizations created from 28 Oct 2026 can add, reorder and remove their own roles.":
		". Diese Organisation wurde vor eigenen Rollen gegründet; ab dem 28. Okt. 2026 gegründete Organisationen können eigene Rollen hinzufügen, umsortieren und entfernen.",
	"Name the role with letters or digits, like coach or project lead.":
		"Benennen Sie die Rolle mit Buchstaben oder Ziffern, etwa trainer oder projektleitung.",
	"This organization already has that role.": "Diese Organisation hat diese Rolle bereits.",
	"An organization has at most {count} roles.": "Eine Organisation hat höchstens {count} Rollen.",
	"Highest first. A higher role can approve wherever a lower one is asked for. Changing the roles is a rule change like any other, and the rules document's fingerprint covers them.":
		"Höchste zuerst. Eine höhere Rolle kann überall freigeben, wo eine niedrigere verlangt wird. Rollen zu ändern ist eine Regeländerung wie jede andere, und der Fingerabdruck des Regeldokuments umfasst sie.",
	"nobody yet": "noch niemand",
	"Move {name} up": "{name} nach oben",
	"Move {name} down": "{name} nach unten",
	"Remove {name}": "{name} entfernen",
	"Give these people another role first.": "Geben Sie diesen Personen zuerst eine andere Rolle.",
	"New role": "Neue Rolle",
	Coach: "Trainer",
	"Add role": "Rolle hinzufügen",
	"Save roles": "Rollen speichern",
	Discard: "Verwerfen",
	"Rules document": "Regeldokument",
	"Does not match the contract": "Stimmt nicht mit dem Vertrag überein",
	"The rules above are one readable document. Its fingerprint (SHA-256) is":
		"Die Regeln oben sind ein lesbares Dokument. Sein Fingerabdruck (SHA-256) ist",
	"stored in the organization's contract": "im Vertrag der Organisation gespeichert",
	"shown here": "hier angezeigt",
	", so anyone can check that the active rules are exactly these.":
		", sodass jede Person prüfen kann, dass genau diese Regeln gelten.",
	" This organization's active document is version 2; its next approved rule change is written as version 3.":
		" Das gültige Dokument dieser Organisation ist Version 2; ihre nächste freigegebene Regeländerung wird als Version 3 geschrieben.",
	" Version 3 is canonical JSON in the style of stellar-registry/perch (sorted keys, no whitespace, amounts as decimal strings).":
		" Version 3 ist kanonisches JSON im Stil von stellar-registry/perch (sortierte Schlüssel, keine Leerzeichen, Beträge als Dezimal-Strings).",
	"Who approves what, in {currency}. The organization's contract enforces these rules; payments in another currency take the strictest tier.":
		"Wer was freigibt, in {currency}. Der Vertrag der Organisation setzt diese Regeln durch; Zahlungen in einer anderen Währung nehmen die strengste Stufe.",
	"Setup phase": "Einrichtungsphase",
	"Changing the rules": "Regeln ändern",
	"Nobody else could approve yet, so you can add people and change the rules directly. Once others can approve, changes need their approval.":
		"Noch kann niemand sonst freigeben, daher können Sie Personen hinzufügen und die Regeln direkt ändern. Sobald andere freigeben können, brauchen Änderungen deren Freigabe.",
	"The founder is still setting up this organization and can make changes directly.":
		"Der Gründer richtet diese Organisation noch ein und kann Änderungen direkt vornehmen.",
	"Pick someone else as the successor.": "Wählen Sie eine andere Person als Nachfolge.",
	"Enter the quiet period and the wait in days (at least a minute each).":
		"Geben Sie die Ruhezeit und die Wartezeit in Tagen ein (jeweils mindestens eine Minute).",
	"Claimed; the handover can be finished now.":
		"Beansprucht; die Übergabe kann jetzt abgeschlossen werden.",
	"Done.": "Erledigt.",
	Succession: "Nachfolge",
	"If someone goes quiet for longer than their quiet period, the successor they were given can claim their position. Any action of theirs during the wait cancels the claim; after it, the successor takes over and they leave. Money never moves.":
		"Ist jemand länger als die Ruhezeit untätig, kann die für die Person bestimmte Nachfolge ihre Position beanspruchen. Jede Aktion der Person während der Wartezeit bricht den Anspruch ab; danach übernimmt die Nachfolge, und die Person scheidet aus. Geld bewegt sich nie.",
	"takes over from": "übernimmt von",
	after: "nach",
	"quiet days.": "Ruhetagen.",
	"I'm still here": "Ich bin noch da",
	"Claim the position": "Position beanspruchen",
	"Finish the handover": "Übergabe abschließen",
	"Position of": "Position von",
	"Taken over by": "Übernommen von",
	"Quiet days": "Ruhetage",
	"Save successor": "Nachfolge speichern",
	"Based on the": "Beruht auf der Vorlage",
	"template.": ".",
	"Switch template": "Vorlage wechseln",
	"People keep their rank (highest role to highest role), so nobody silently loses access. Tier limits reset to the template's defaults.":
		"Personen behalten ihren Rang (höchste Rolle zu höchster Rolle), sodass niemand unbemerkt den Zugang verliert. Die Stufengrenzen werden auf die Werte der Vorlage zurückgesetzt.",
	Switch: "Wechseln",
	"Approval tiers": "Freigabestufen",
	"Tier {number} upper limit in {currency}": "Obergrenze der Stufe {number} in {currency}",
	Needs: "Braucht",
	"Tier {number} objection window in hours": "Einspruchsfrist der Stufe {number} in Stunden",
	hours: "Stunden",
	"First payment to a new recipient: at least":
		"Erste Zahlung an einen neuen Empfänger: mindestens",
	"Done. Applied directly during the setup phase.":
		"Erledigt. Während der Einrichtungsphase direkt angewendet.",
	"Change requested. It takes effect once approved.":
		"Änderung angefragt. Sie gilt, sobald sie freigegeben ist.",
	"Enter the auditor's ancora ID or Stellar address (starts with C or G).":
		"Geben Sie die ancora-ID oder Stellar-Adresse des Prüfers ein (beginnt mit C oder G).",
	"Add an auditor": "Prüfer hinzufügen",
	"Auditor added. Once they set up their device, share access with them.":
		"Prüfer hinzugefügt. Sobald das Gerät eingerichtet ist, teilen Sie den Zugang.",
	"Remove an auditor": "Prüfer entfernen",
	"Auditor removed. Renew the key so they can't read what comes next.":
		"Prüfer entfernt. Erneuern Sie den Schlüssel, damit Künftiges nicht mehr lesbar ist.",
	"Auditors read your private details on their own audit page (ancora → Audit) once access is shared with them. They can't change anything.":
		"Prüfer lesen Ihre vertraulichen Angaben auf ihrer eigenen Prüfseite (ancora → Prüfung), sobald der Zugang mit ihnen geteilt ist. Sie können nichts ändern.",
	"Their ancora ID (C…)": "Ihre ancora-ID (C…)",
	"Add auditor": "Prüfer hinzufügen",
	"sample data": "Beispieldaten",
	"Data source": "Datenquelle",
	"Site default ({mode})": "Standard der Website ({mode})",
	"Sample data is shown until it answers again.":
		"Bis es wieder antwortet, werden Beispieldaten angezeigt.",
	"Change the logo of {organization}": "Logo von {organization} ändern",
	"Logo updated.": "Logo aktualisiert.",
	"Organization logo": "Logo der Organisation",
	"Stored in this browser": "In diesem Browser gespeichert",
	"PNG, JPG or WebP, up to 5 MB. Resized to 256×256 in your browser":
		"PNG, JPG oder WebP, bis 5 MB. In Ihrem Browser auf 256×256 verkleinert",
	", stored with the organization on Stellar": ", bei der Organisation auf Stellar gespeichert",
	"Only the organization's highest role can change the logo.":
		"Nur die höchste Rolle der Organisation kann das Logo ändern.",
	"Organization code": "Code der Organisation",
	"ancora publishes every version of the organization's code on the Stellar Registry, where anyone can compare it with what this contract runs. Nobody can change the code for you: a move to a new release is a change the members approve under your rules.":
		"ancora veröffentlicht jede Version des Codes der Organisation in der Stellar Registry, wo jede Person sie mit dem vergleichen kann, was dieser Vertrag ausführt. Niemand kann den Code für Sie ändern: Der Wechsel zu einer neuen Version ist eine Änderung, die die Mitglieder nach Ihren Regeln freigeben.",
	Runs: "Läuft mit",
	"Latest release": "Neueste Version",
	"ancora-organization": "ancora-organization",
	"Registry on Stellar": "Registry auf Stellar",
	"During the setup phase the founder moves to it directly.":
		"In der Einrichtungsphase wechselt der Gründer direkt.",
	"Moving to it becomes a request that follows your rules for changes.":
		"Der Wechsel wird eine Anfrage, die Ihren Regeln für Änderungen folgt.",
	"Move to release": "Zur Version wechseln",
	"This organization was created before organizations could move to new releases, so its code stays as it is. Organizations created from 1 Nov 2026 can.":
		"Diese Organisation wurde gegründet, bevor Organisationen zu neuen Versionen wechseln konnten, daher bleibt ihr Code, wie er ist. Ab dem 1. Nov. 2026 gegründete Organisationen können es.",
	"Private details": "Vertrauliche Angaben",
	"Payment references and discussion entries can be stored on Stellar encrypted, so only your organization's members read them. Amounts and who you pay stay visible on the public network. Each person's key stays on their device; a new device gets access when another member shares it.":
		"Verwendungszwecke und Diskussionsbeiträge können verschlüsselt auf Stellar gespeichert werden, sodass nur die Mitglieder Ihrer Organisation sie lesen. Beträge und wen Sie bezahlen, bleiben im öffentlichen Netzwerk sichtbar. Der Schlüssel jeder Person bleibt auf ihrem Gerät; ein neues Gerät erhält Zugang, wenn ein anderes Mitglied ihn teilt.",
	"References and discussions": "Verwendungszwecke und Diskussionen",
	"Readable by anyone on the network": "Für alle im Netzwerk lesbar",
	" · not readable on this device yet": " · auf diesem Gerät noch nicht lesbar",
	"This device": "Dieses Gerät",
	"Set up": "Eingerichtet",
	"Not set up": "Nicht eingerichtet",
	"Not set up yet": "Noch nicht eingerichtet",
	"Make details private": "Angaben vertraulich machen",
	"Share access with": "Zugang teilen mit",
	"Renew the key (after someone leaves)": "Schlüssel erneuern (nachdem jemand gegangen ist)",
	"Use 2 to 32 lowercase letters, digits or dashes, like tejo-rowing-club.":
		"Verwenden Sie 2 bis 32 Kleinbuchstaben, Ziffern oder Bindestriche, etwa tejo-rowing-club.",
	"Register {organization} as {name}": "{organization} als {name} registrieren",
	'Registered. {organization} is now "{name}" on the Stellar Registry.':
		"Registriert. {organization} heißt in der Stellar Registry jetzt „{name}“.",
	"Name on the Stellar Registry": "Name in der Stellar Registry",
	"The Stellar Registry is a public, on-chain directory of contracts by name. A name lets people find and verify this organization's treasury contract without copying an address.":
		"Die Stellar Registry ist ein öffentliches On-chain-Verzeichnis von Verträgen nach Namen. Mit einem Namen finden und prüfen Personen den Vertrag dieser Organisation, ohne eine Adresse zu kopieren.",
	"Registered as": "Registriert als",
	" · points to this contract": " · verweist auf diesen Vertrag",
	" · not found on the registry": " · in der Registry nicht gefunden",
	"No name yet.": "Noch kein Name.",
	"Register another name": "Weiteren Namen registrieren",
	"Lowercase letters, digits and dashes. Registered by your pass, which the registry records as the owner.":
		"Kleinbuchstaben, Ziffern und Bindestriche. Registriert von Ihrem Pass, den die Registry als Eigentümer festhält.",
	"” is free.": "“ ist frei.",
	"Register with my passkey": "Mit meinem Passkey registrieren",
	"” is already taken on the registry.": "“ ist in der Registry schon vergeben.",
	"Check availability": "Verfügbarkeit prüfen",
	"Only the organization's highest role registers a name.":
		"Nur die höchste Rolle der Organisation registriert einen Namen.",
	"Register my quantum-safe seal key": "Meinen quantensicheren Siegelschlüssel registrieren",
	"Your seal key is on this device and registered with the organization.":
		"Ihr Siegelschlüssel ist auf diesem Gerät und bei der Organisation registriert.",
	"Payments above the seal threshold need an extra seal. With quantum-safe seals it is signed by an ML-DSA key (FIPS 204) that stays on the approving device, and the organization checks it before the money moves; a passkey alone no longer seals.":
		"Zahlungen über der Siegelschwelle brauchen ein zusätzliches Siegel. Mit quantensicheren Siegeln wird es mit einem ML-DSA-Schlüssel (FIPS 204) signiert, der auf dem freigebenden Gerät bleibt, und die Organisation prüft es, bevor das Geld fließt; ein Passkey allein siegelt nicht mehr.",
	Seals: "Siegel",
	"Quantum-safe keys required": "Quantensichere Schlüssel verlangt",
	"Your seal key": "Ihr Siegelschlüssel",
	"On this device": "Auf diesem Gerät",
	"Registered from another device; seal from there":
		"Von einem anderen Gerät registriert; siegeln Sie von dort",
	"Not created yet": "Noch nicht erstellt",
	"Members with a key": "Mitglieder mit Schlüssel",
	"None yet": "Noch keine",
	"Create my seal key on this device": "Meinen Siegelschlüssel auf diesem Gerät erstellen",
	"Go back to passkey seals": "Zurück zu Passkey-Siegeln",
	"Require quantum-safe seals": "Quantensichere Siegel verlangen",
	"For the organization you're viewing. Your own profile, theme and data source are on":
		"Für die Organisation, die Sie ansehen. Ihr eigenes Profil, Design und Ihre Datenquelle finden Sie unter",
	"your pass": "Ihr Pass",
	"On Stellar": "Auf Stellar",
	"This is a sample organization; nothing about it is on Stellar. Switch to the testnet on your pass to create a real one.":
		"Dies ist eine Beispielorganisation; nichts davon ist auf Stellar. Wechseln Sie in Ihrem Pass zum Testnet, um eine echte zu gründen.",
	"Account address on Stellar": "Kontoadresse auf Stellar",
	"On: the founder can still change people and rules directly.":
		"An: Der Gründer kann Personen und Regeln noch direkt ändern.",
	"Over: changes to people and rules need approval like any request.":
		"Vorbei: Änderungen an Personen und Regeln brauchen wie jede Anfrage eine Freigabe.",
	"Verify on the Rules page": "Auf der Seite Regeln prüfen",
	"The contract holds the money, knows its members by their ancora ID and enforces the rules itself. ancora's operator deploys it and sponsors fees, but holds no role in it.":
		"Der Vertrag hält das Geld, kennt seine Mitglieder über ihre ancora-ID und setzt die Regeln selbst durch. Der Betreiber von ancora legt ihn an und übernimmt die Gebühren, hat darin aber keine Rolle.",
	"Testnet deployments": "Testnet-Bereitstellungen",
	"Not configured in this build. Run scripts/setup-testnet.sh to generate app/.env.testnet.":
		"In diesem Build nicht konfiguriert. Führen Sie scripts/setup-testnet.sh aus, um app/.env.testnet zu erzeugen.",
	"Checking the Stellar testnet…": "Stellar-Testnet wird geprüft…",
	"Connecting to Stellar testnet…": "Verbindung zum Stellar-Testnet…",
	"Unknown person": "Unbekannte Person",
	"Restoring your session…": "Ihre Sitzung wird wiederhergestellt…",
	day: "Tag",
	week: "Woche",
	"30 days": "30 Tage",
	quarter: "Quartal",
	year: "Jahr",
	"2 minutes (demo)": "2 Minuten (Demo)",
	"1 day": "1 Tag",
	"7 days": "7 Tage",
	"Club or association": "Verein oder Verband",
	Company: "Unternehmen",
	Team: "Team",
	treasurer: "Kassenwart",
	treasurers: "Kassenwarte",
	"board member": "Vorstandsmitglied",
	"board members": "Vorstandsmitglieder",
	member: "Mitglied",
	members: "Mitglieder",
	"managing director": "Geschäftsführung",
	"managing directors": "Geschäftsführung",
	finance: "Finanzen",
	employee: "Mitarbeitende",
	employees: "Mitarbeitende",
	"team lead": "Teamleitung",
	"team leads": "Teamleitungen",
	"unknown role": "unbekannte Rolle",
	"Private where it matters": "Vertraulich, wo es zählt",
	"Payment references, recipients and discussions are stored encrypted, so only your members and the auditors you choose can read them. Amounts stay verifiable on the ledger.":
		"Verwendungszwecke, Empfänger und Diskussionen werden verschlüsselt gespeichert, sodass nur Ihre Mitglieder und die von Ihnen gewählten Prüfer sie lesen. Beträge bleiben im Ledger überprüfbar.",
	"Work with other organizations": "Mit anderen Organisationen arbeiten",
	"Agree milestones with a supplier or partner, deposit up front and release each payment when the work is delivered. Both sides decide under their own approval rules.":
		"Vereinbaren Sie Meilensteine mit einem Lieferanten oder Partner, hinterlegen Sie den Betrag vorab und geben Sie jede Zahlung frei, wenn die Arbeit geliefert ist. Beide Seiten entscheiden nach ihren eigenen Freigaberegeln.",
	"Open source": "Open Source",
	"Nobody but the organization controls its money: ancora holds no key to any account. ancora runs on the Stellar test network today; mainnet follows an external security review.":
		"Niemand außer der Organisation verfügt über ihr Geld: ancora hat keinen Schlüssel zu irgendeinem Konto. ancora läuft heute im Stellar-Testnetz; das Hauptnetz folgt nach einer externen Sicherheitsprüfung.",
	"The business account your organization controls.":
		"Das Geschäftskonto, das Ihre Organisation selbst steuert.",
	Footer: "Fußzeile",
	Product: "Produkt",
	Roadmap: "Roadmap",
	"© 2026 ancora. ancora is not a bank; balances are not deposit-insured. Currently on the Stellar test network with test money. Licensed payment partners handle bank transfers.":
		"© 2026 ancora. ancora ist keine Bank; Guthaben unterliegen keiner Einlagensicherung. Derzeit im Stellar-Testnetz mit Testgeld. Banküberweisungen übernehmen lizenzierte Zahlungspartner.",
	"Non-custodial by design": "Ohne Verwahrung, von Grund auf",
	Treasurer: "Kassenwart",
	"Board member": "Vorstandsmitglied",
	"Board members": "Vorstandsmitglieder",
	Member: "Mitglied",
	Members: "Mitglieder",
	"{list} and {last}": "{list} und {last}",
	"no approval": "keine Freigabe",
	"Within the requester's spending limit. No approval needed, it goes out right away.":
		"Innerhalb des Ausgabelimits der antragstellenden Person. Keine Freigabe nötig, die Zahlung geht sofort raus.",
	"Over its budget for this period, so the strictest tier applies.":
		"Das Budget für diesen Zeitraum ist überschritten, daher gilt die strengste Stufe.",
	"No approval needed. It goes out right away.":
		"Keine Freigabe nötig. Die Zahlung geht sofort raus.",
	"No approval needed, then a {hours}-hour objection window.":
		"Keine Freigabe nötig, danach eine Einspruchsfrist von {hours} Stunden.",
	"Needs {approvals}, then a {hours}-hour objection window.":
		"Benötigt {approvals}, danach eine Einspruchsfrist von {hours} Stunden.",
	"Needs {approvals}.": "Benötigt {approvals}.",
	"The security seal is required.": "Das Sicherheitssiegel ist erforderlich.",
	"Add {name} as {role}": "{name} als {role} hinzufügen",
	"Make {name} {role}": "{name} zu {role} machen",
	"Update the approval rules": "Freigaberegeln ändern",
	"Switch to the {template} template": "Zur Vorlage „{template}“ wechseln",
	"Accept {asset}": "{asset} annehmen",
	"Stop accepting {asset}": "{asset} nicht mehr annehmen",
	"Set the roles to {roles}": "Rollen festlegen: {roles}",
	"Move to ancora release {version}": "Auf ancora-Version {version} wechseln",
	"in {asset}": "in {asset}",
	"for #{category}": "für #{category}",
	"Remove the allowance of {name} {scope}": "Kontingent von {name} {scope} entfernen",
	"Let {name} pay {amount} per {period} {scope} without approvals":
		"{name} darf {amount} pro {period} {scope} ohne Freigabe zahlen",
	"Pay any recipient under the normal rules": "An alle Empfänger nach den normalen Regeln zahlen",
	"Pay only the 1 allowed recipient": "Nur an den 1 zugelassenen Empfänger zahlen",
	"Pay only the {count} allowed recipients": "Nur an die {count} zugelassenen Empfänger zahlen",
	"Send payments outside the 1 allowed recipient to the strictest approvals":
		"Zahlungen außerhalb des 1 zugelassenen Empfängers brauchen die strengsten Freigaben",
	"Send payments outside the {count} allowed recipients to the strictest approvals":
		"Zahlungen außerhalb der {count} zugelassenen Empfänger brauchen die strengsten Freigaben",
	"Remove the successor of {name}": "Nachfolge für {name} entfernen",
	"Let {successor} take over from {name} after {days} quiet days":
		"{successor} übernimmt für {name} nach {days} inaktiven Tagen",
	"Seal large payments with quantum-safe keys":
		"Große Zahlungen mit quantensicheren Schlüsseln versiegeln",
	"Seal large payments with passkeys only": "Große Zahlungen nur mit Passkeys versiegeln",
	"Use live exchange rates for payments in other currencies":
		"Aktuelle Wechselkurse für Zahlungen in anderen Währungen verwenden",
	"Stop using exchange rates; other currencies take the strictest approvals":
		"Keine Wechselkurse mehr verwenden; andere Währungen brauchen die strengsten Freigaben",
	"Remove the spending limit of {name}": "Ausgabelimit von {name} entfernen",
	"Give {name} a spending limit of {amount} per {period}":
		"{name} ein Ausgabelimit von {amount} pro {period} geben",
	"milestone {number}": "Meilenstein {number}",
	"{amount} to 1 recipient": "{amount} an 1 Empfänger",
	"{amount} to {count} recipients": "{amount} an {count} Empfänger",
	"{amount} to {recipient}": "{amount} an {recipient}",
	"a recipient": "einen Empfänger",
	"Open the confidential pot": "Vertrauliche Kasse eröffnen",
	"Move {amount} into the confidential pot": "{amount} in die vertrauliche Kasse verschieben",
	"Take {amount} out of the confidential pot": "{amount} aus der vertraulichen Kasse entnehmen",
	"Confidential payment to {name}": "Vertrauliche Zahlung an {name}",
	"Propose a deal of 1 milestone": "Vereinbarung mit 1 Meilenstein vorschlagen",
	"Propose a deal of {count} milestones": "Vereinbarung mit {count} Meilensteinen vorschlagen",
	"Accept the terms of deal #{deal}": "Bedingungen von Vereinbarung #{deal} annehmen",
	"Deposit the amount for deal #{deal}": "Betrag für Vereinbarung #{deal} hinterlegen",
	'Ask for the payout of "{milestone}"': "Auszahlung von „{milestone}“ anfordern",
	'Approve the payout of "{milestone}"': "Auszahlung von „{milestone}“ freigeben",
	'Object to the payout of "{milestone}"': "Der Auszahlung von „{milestone}“ widersprechen",
	"Cancel deal #{deal}": "Vereinbarung #{deal} abbrechen",
	"Ask the arbiter to decide deal #{deal}":
		"Schlichter über Vereinbarung #{deal} entscheiden lassen",
	'Pay out "{milestone}" now': "„{milestone}“ jetzt auszahlen",
	"Deal #{deal} with {name}": "Vereinbarung #{deal} mit {name}",
	"Deal #{deal} from {name}": "Vereinbarung #{deal} von {name}",
	"1 milestone": "1 Meilenstein",
	"{count} milestones": "{count} Meilensteine",
	"Waiting for the other side to accept": "Wartet auf die Zustimmung der anderen Seite",
	"Waiting for the deposit": "Wartet auf die Hinterlegung",
	"Amount deposited": "Betrag hinterlegt",
	"In progress": "Läuft",
	Completed: "Abgeschlossen",
	"With the arbiter": "Beim Schlichter",
	"Decided by the arbiter": "Vom Schlichter entschieden",
	"Not started": "Nicht begonnen",
	"Payout requested": "Auszahlung angefordert",
	Objected: "Widersprochen",
	"This deal doesn't exist.": "Diese Vereinbarung gibt es nicht.",
	"The deal has moved on, so this step no longer applies. Reload to see where it stands.":
		"Die Vereinbarung ist weiter, dieser Schritt passt nicht mehr. Laden Sie neu, um den Stand zu sehen.",
	"Only the parties of the deal can do this.": "Das können nur die Parteien der Vereinbarung.",
	"The terms aren't valid: two different parties, one to twenty milestones above zero, an objection period from one minute to 90 days, and an arbiter who isn't a party.":
		"Die Bedingungen sind ungültig: zwei verschiedene Parteien, ein bis zwanzig Meilensteine über null, eine Einspruchsfrist von einer Minute bis 90 Tagen und ein Schlichter, der keine Partei ist.",
	"This milestone doesn't exist.": "Diesen Meilenstein gibt es nicht.",
	"This milestone isn't in a state that allows this step.":
		"Dieser Meilenstein lässt diesen Schritt gerade nicht zu.",
	"The objection period is still running.": "Die Einspruchsfrist läuft noch.",
	"The objection period is over.": "Die Einspruchsfrist ist vorbei.",
	"This deal has no arbiter.": "Diese Vereinbarung hat keinen Schlichter.",
	"The arbiter has to split exactly what is left between the two parties.":
		"Der Schlichter muss genau den Restbetrag zwischen beiden Parteien aufteilen.",
	"You already asked to cancel; the other side has to agree.":
		"Sie haben den Abbruch schon beantragt; die andere Seite muss zustimmen.",
	"A milestone name is too long (64 characters at most).":
		"Ein Meilensteinname ist zu lang (höchstens 64 Zeichen).",
	"The deal didn't accept this step.": "Die Vereinbarung hat diesen Schritt nicht angenommen.",
	"The deal couldn't be read. Check the deal number and try again.":
		"Die Vereinbarung ließ sich nicht lesen. Prüfen Sie die Nummer und versuchen Sie es erneut.",
	"The deal didn't accept this step; it may have moved on. Reload to see where it stands.":
		"Die Vereinbarung hat diesen Schritt nicht angenommen; sie ist vielleicht weiter. Laden Sie neu, um den Stand zu sehen.",
	"This organization doesn't hold that asset.": "Diese Organisation führt diese Währung nicht.",
	"There isn't enough money available on the main account. Enter a smaller amount or move money from the Reserve.":
		"Auf dem Hauptkonto ist nicht genug Geld verfügbar. Geben Sie einen kleineren Betrag ein oder holen Sie Geld aus der Reserve.",
	"The Reserve doesn't hold that much. Enter a smaller amount.":
		"So viel liegt nicht in der Reserve. Geben Sie einen kleineren Betrag ein.",
	"The file is empty.": "Die Datei ist leer.",
	"The file has a header but no payments.": "Die Datei hat eine Kopfzeile, aber keine Zahlungen.",
	"Write something first.": "Schreiben Sie zuerst etwas.",
	"Name at least one guardian.": "Nennen Sie mindestens eine Vertrauensperson.",
	"You can't be your own guardian.": "Sie können nicht Ihre eigene Vertrauensperson sein.",
	"Each guardian once.": "Jede Vertrauensperson nur einmal.",
	"The number of confirmations must be between 1 and the number of guardians.":
		"Die Zahl der Bestätigungen muss zwischen 1 und der Zahl der Vertrauenspersonen liegen.",
	"The waiting period is at least a minute.": "Die Wartezeit beträgt mindestens eine Minute.",
	"Pick one of this template's roles for yourself.":
		"Wählen Sie für sich eine der Rollen dieser Vorlage.",
	"This change needs approval now that your organization has enough people. Create a request instead.":
		"Diese Änderung braucht eine Freigabe, da Ihre Organisation jetzt genug Mitglieder hat. Erstellen Sie stattdessen eine Anfrage.",
	"After this change, nobody could approve large payments or changes anymore. Add someone with the required role first.":
		"Nach dieser Änderung könnte niemand mehr große Zahlungen oder Änderungen freigeben. Fügen Sie zuerst jemanden mit der nötigen Rolle hinzu.",
	"This person isn't part of the organization.": "Diese Person gehört nicht zur Organisation.",
	"Pick one of the organization's roles.": "Wählen Sie eine der Rollen der Organisation.",
	"This person is already part of the organization.": "Diese Person gehört schon zur Organisation.",
	"The organization already accepts this asset.": "Die Organisation nimmt diese Währung schon an.",
	"An organization has to accept at least one asset.":
		"Eine Organisation muss mindestens eine Währung annehmen.",
	"An allowance needs an accepted asset or a budget category (a category only in the rules' currency), an amount above zero and a period.":
		"Ein Kontingent braucht eine angenommene Währung oder eine Budgetkategorie (eine Kategorie nur in der Währung der Regeln), einen Betrag über null und einen Zeitraum.",
	"An allowlist holds up to 100 different addresses.":
		"Eine Freigabeliste fasst bis zu 100 verschiedene Adressen.",
	"The last tier must have no upper limit, so every amount is covered.":
		"Die letzte Stufe darf keine Obergrenze haben, damit jeder Betrag abgedeckt ist.",
	"The security seal threshold must be an amount above zero.":
		"Die Schwelle für das Sicherheitssiegel muss ein Betrag über null sein.",
	"Up to 20 budgets.": "Bis zu 20 Budgets.",
	"The rules mention a role that doesn't exist.":
		"Die Regeln nennen eine Rolle, die es nicht gibt.",
	"Each required approval needs a count of at least 1.":
		"Jede nötige Freigabe braucht eine Anzahl von mindestens 1.",
	"Every role needs its own name of letters or digits.":
		"Jede Rolle braucht einen eigenen Namen aus Buchstaben oder Ziffern.",
	"Someone still holds a role you're removing. Give them another role first.":
		"Jemand hat noch eine Rolle, die Sie entfernen. Geben Sie der Person zuerst eine andere Rolle.",
	"The approval rules still ask for a role you're removing. Change the tiers first.":
		"Die Freigaberegeln verlangen noch eine Rolle, die Sie entfernen. Ändern Sie zuerst die Stufen.",
	"You're not part of this organization, so you can't do this.":
		"Sie gehören nicht zu dieser Organisation und können das daher nicht tun.",
	"The organization only pays recipients on its allowlist. Ask for this recipient to be added on the Rules page.":
		"Die Organisation zahlt nur an Empfänger auf ihrer Freigabeliste. Bitten Sie auf der Seite Regeln darum, diesen Empfänger aufzunehmen.",
	"Every line needs an amount above zero.": "Jede Zeile braucht einen Betrag über null.",
	"You created this request, so someone else has to approve it.":
		"Sie haben diese Anfrage erstellt, daher muss jemand anderes sie freigeben.",
	"You've already approved this request.": "Sie haben diese Anfrage schon freigegeben.",
	"Your role can't approve this request.": "Ihre Rolle kann diese Anfrage nicht freigeben.",
	"Your approval isn't needed: the remaining approvals must come from a higher role.":
		"Ihre Freigabe wird nicht gebraucht: Die übrigen Freigaben müssen von einer höheren Rolle kommen.",
	"This request doesn't need the security seal.": "Diese Anfrage braucht kein Sicherheitssiegel.",
	"This request already has the security seal.": "Diese Anfrage hat das Sicherheitssiegel schon.",
	"You created this request, so someone else has to seal it.":
		"Sie haben diese Anfrage erstellt, daher muss jemand anderes sie versiegeln.",
	"Your role can't seal this request.": "Ihre Rolle kann diese Anfrage nicht versiegeln.",
	"This request is already decided and can't be declined.":
		"Über diese Anfrage ist schon entschieden; sie kann nicht abgelehnt werden.",
	"Your role can't decline this request.": "Ihre Rolle kann diese Anfrage nicht ablehnen.",
	"This request can't be executed yet.": "Diese Anfrage kann noch nicht ausgeführt werden.",
	"This payment isn't a held handover waiting for confirmations.":
		"Diese Zahlung ist keine zurückgehaltene Übergabe, die auf Bestätigungen wartet.",
	"Only the recipient, the requester or an eligible approver can confirm this handover.":
		"Nur der Empfänger, die antragstellende Person oder eine berechtigte freigebende Person kann diese Übergabe bestätigen.",
	"Only the requester or an eligible approver can cancel this handover.":
		"Nur die antragstellende Person oder eine berechtigte freigebende Person kann diese Übergabe abbrechen.",
	"This request is no longer waiting for approvals.":
		"Diese Anfrage wartet nicht mehr auf Freigaben.",
	"You're not part of this organization.": "Sie gehören nicht zu dieser Organisation.",
	"These rules aren't valid.": "Diese Regeln sind ungültig.",
	"This request can't be declined.": "Diese Anfrage kann nicht abgelehnt werden.",
	"This change needs approval now that your organization has enough people.":
		"Diese Änderung braucht eine Freigabe, da Ihre Organisation jetzt genug Mitglieder hat.",
	"After this change, nobody could approve large payments or changes anymore.":
		"Nach dieser Änderung könnte niemand mehr große Zahlungen oder Änderungen freigeben.",
	"There isn't enough money available on the account.":
		"Auf dem Konto ist nicht genug Geld verfügbar.",
	"This request doesn't exist.": "Diese Anfrage gibt es nicht.",
	"Only the founder can do this during setup.":
		"Während der Einrichtung kann das nur die gründende Person.",
	"Unknown template.": "Unbekannte Vorlage.",
	"That text is too long.": "Dieser Text ist zu lang.",
	"This asset still holds money or has open requests, so it can't be removed.":
		"In dieser Währung liegt noch Geld oder es gibt offene Anfragen, daher kann sie nicht entfernt werden.",
	"This asset has no Reserve yet.": "Diese Währung hat noch keine Reserve.",
	"Your role can't move money between the account and the Reserve.":
		"Ihre Rolle kann kein Geld zwischen Konto und Reserve bewegen.",
	"A spending limit needs an amount above zero and a period.":
		"Ein Ausgabelimit braucht einen Betrag über null und einen Zeitraum.",
	"This goes beyond what is left of a hard budget this period, so it isn't accepted.":
		"Das übersteigt den Rest eines festen Budgets in diesem Zeitraum und wird daher nicht angenommen.",
	"The rules have no budget with that name.": "Die Regeln haben kein Budget mit diesem Namen.",
	"Only the recipient, the requester or an eligible approver can act on this handover.":
		"Nur der Empfänger, die antragstellende Person oder eine berechtigte freigebende Person kann bei dieser Übergabe handeln.",
	"There is no standing order with this number.": "Es gibt keinen Dauerauftrag mit dieser Nummer.",
	"This standing order isn't due yet.": "Dieser Dauerauftrag ist noch nicht fällig.",
	"A standing order repeats at least every hour.":
		"Ein Dauerauftrag wiederholt sich höchstens stündlich.",
	"An organization has one to eight roles, each with its own name.":
		"Eine Organisation hat ein bis acht Rollen mit jeweils eigenem Namen.",
	"The address book is full (200 recipients). Remove someone you no longer pay.":
		"Das Adressbuch ist voll (200 Empfänger). Entfernen Sie jemanden, den Sie nicht mehr bezahlen.",
	"A batch has one to fifty payments.": "Eine Sammelzahlung hat ein bis fünfzig Zahlungen.",
	"This payment link doesn't exist.": "Diesen Zahlungslink gibt es nicht.",
	"This payment link is closed or fully paid.":
		"Dieser Zahlungslink ist geschlossen oder vollständig bezahlt.",
	"This wallet has already paid this link.": "Diese Wallet hat diesen Link schon bezahlt.",
	"A newer ancora release was published after this upgrade was proposed. Propose the upgrade to the newest release.":
		"Nach dem Vorschlag dieses Upgrades ist eine neuere ancora-Version erschienen. Schlagen Sie das Upgrade auf die neueste Version vor.",
	"The Stellar Registry didn't confirm an ancora release. Try again in a moment.":
		"Die Stellar Registry hat keine ancora-Version bestätigt. Versuchen Sie es gleich noch einmal.",
	"That exchange-rate service didn't answer. Try again later.":
		"Dieser Wechselkursdienst hat nicht geantwortet. Versuchen Sie es später erneut.",
	"Only the successor named for this person can claim their position.":
		"Nur die für diese Person benannte Nachfolge kann ihre Position übernehmen.",
	"This person was active recently, so their position can't be claimed yet.":
		"Diese Person war kürzlich aktiv, daher kann ihre Position noch nicht übernommen werden.",
	"There is no open claim on this position (the person may have been active since).":
		"Für diese Position gibt es keinen offenen Anspruch (die Person war vielleicht inzwischen aktiv).",
	"The waiting period hasn't passed yet.": "Die Wartezeit ist noch nicht vorbei.",
	"This organization seals with quantum-safe keys. Create your seal key on your pass first.":
		"Diese Organisation versiegelt mit quantensicheren Schlüsseln. Erstellen Sie zuerst Ihren Siegelschlüssel in Ihrem Pass.",
	"The quantum-safe signature didn't match your registered seal key. Seal from the device that holds your key.":
		"Die quantensichere Signatur passt nicht zu Ihrem registrierten Siegelschlüssel. Versiegeln Sie auf dem Gerät mit Ihrem Schlüssel.",
	"The change could not be applied.": "Die Änderung konnte nicht übernommen werden.",
	"The confidential pot didn't accept this step.":
		"Die vertrauliche Kasse hat diesen Schritt nicht angenommen.",
	"The pot's auditor key isn't registered. Set the pot up again.":
		"Der Prüferschlüssel der Kasse ist nicht registriert. Richten Sie die Kasse erneut ein.",
	"This organization already has a pot account.": "Diese Organisation hat schon ein Kassenkonto.",
	"The other side has no pot account yet. Ask them to open their confidential pot.":
		"Die andere Seite hat noch kein Kassenkonto. Bitten Sie sie, ihre vertrauliche Kasse zu eröffnen.",
	"The pot didn't accept the proof: the balance changed since the request was made. Make it again.":
		"Die Kasse hat den Nachweis nicht angenommen: Der Saldo hat sich seit der Anfrage geändert. Stellen Sie sie erneut.",
	"The pot couldn't read this request's proof. Make it again.":
		"Die Kasse konnte den Nachweis dieser Anfrage nicht lesen. Stellen Sie sie erneut.",
	"This organization's code predates the pot. Move to the latest release under Settings → Organization code.":
		"Der Code dieser Organisation ist älter als die Kasse. Wechseln Sie unter Einstellungen → Code der Organisation auf die neueste Version.",
	"Turn on private details first (Settings → Private details): the pot key travels the same way.":
		"Schalten Sie zuerst vertrauliche Angaben ein (Einstellungen → Vertrauliche Angaben): Der Kassenschlüssel wird auf demselben Weg geteilt.",
	"This device can't read the organization's private details yet. Set it up and ask a member to share access.":
		"Dieses Gerät kann die vertraulichen Angaben der Organisation noch nicht lesen. Richten Sie es ein und bitten Sie ein Mitglied, den Zugang zu teilen.",
	"The pot key isn't readable on this device.":
		"Der Kassenschlüssel ist auf diesem Gerät nicht lesbar.",
	"The pot key in the keyring doesn't match the pot account.":
		"Der Kassenschlüssel im Schlüsselbund passt nicht zum Kassenkonto.",
	"The pot isn't open and readable on this device.":
		"Die Kasse ist auf diesem Gerät nicht eröffnet und lesbar.",
	"The pot is already open.": "Die Kasse ist schon eröffnet.",
	"This device can't read private details.": "Dieses Gerät kann keine vertraulichen Angaben lesen.",
	"They have no pot account yet. Ask them to open their confidential pot.":
		"Sie haben noch kein Kassenkonto. Bitten Sie sie, ihre vertrauliche Kasse zu eröffnen.",
	"This device can't read the pot key.": "Dieses Gerät kann den Kassenschlüssel nicht lesen.",
	"The pot's balance can't be spent right now. Merge the next payment it receives and try again.":
		"Der Saldo der Kasse ist gerade nicht verfügbar. Führen Sie die nächste eingehende Zahlung zusammen und versuchen Sie es erneut.",
	"The pot doesn't hold that much.": "So viel liegt nicht in der Kasse.",
	"The pot's balance changed. Refresh and try again.":
		"Der Saldo der Kasse hat sich geändert. Aktualisieren Sie und versuchen Sie es erneut.",
	"Only the organization's highest role registers its name.":
		"Nur die höchste Rolle der Organisation registriert ihren Namen.",
	"That name is already taken on the registry.": "Dieser Name ist in der Registry schon vergeben.",
	"You can't react to this entry.": "Auf diesen Eintrag können Sie nicht reagieren.",
	"Only the requester marks questions on their request as answered.":
		"Nur die antragstellende Person markiert Fragen zu ihrer Anfrage als beantwortet.",
	"Only members can ask for money.": "Nur Mitglieder können Geld anfordern.",
	"Only members can set standing orders.": "Nur Mitglieder können Daueraufträge einrichten.",
	"Repeat at least every hour.": "Höchstens stündlich wiederholen.",
	"Only members can edit the address book.": "Nur Mitglieder können das Adressbuch bearbeiten.",
	"Enter the recipient's account.": "Geben Sie das Konto des Empfängers ein.",
	"This standing order was already stopped.": "Dieser Dauerauftrag wurde schon beendet.",
	"Only the person who set this standing order, or the top role, can stop it.":
		"Nur die Person, die diesen Dauerauftrag eingerichtet hat, oder die höchste Rolle kann ihn beenden.",
	"This standing order was stopped.": "Dieser Dauerauftrag wurde beendet.",
	"There is no held handover with this reference. Check the link.":
		"Zu dieser Referenz gibt es keine zurückgehaltene Übergabe. Prüfen Sie den Link.",
	"Payments here go out automatically once they are fully approved.":
		"Zahlungen gehen hier automatisch raus, sobald sie vollständig freigegeben sind.",
	"Enter a token contract address (C…) or a classic asset as CODE:ISSUER.":
		"Geben Sie eine Token-Vertragsadresse (C…) oder ein klassisches Asset als CODE:ISSUER ein.",
	"There is no recovery plan to remove.": "Es gibt keinen Wiederherstellungsplan zum Entfernen.",
	"The new pass must differ from the old one.": "Der neue Pass muss sich vom alten unterscheiden.",
	"There is no open claim for this pass.": "Für diesen Pass gibt es keinen offenen Anspruch.",
	"You already confirmed this claim.": "Sie haben diesen Anspruch schon bestätigt.",
	"There is no open claim to cancel.": "Es gibt keinen offenen Anspruch zum Abbrechen.",
	"There is no open recovery for this pass.": "Für diesen Pass läuft keine Wiederherstellung.",
	"The waiting period isn't over yet.": "Die Wartezeit ist noch nicht vorbei.",
	"This person has no recovery plan.": "Diese Person hat keinen Wiederherstellungsplan.",
	"Only the guardians this person named can do that.":
		"Das können nur die Vertrauenspersonen, die diese Person benannt hat.",
	"Not enough confirmations yet, or the waiting period isn't over.":
		"Noch nicht genug Bestätigungen, oder die Wartezeit ist nicht vorbei.",
	"Only organizations known to the registry take part.":
		"Nur Organisationen, die die Registry kennt, nehmen teil.",
	"This organization or request doesn't exist anymore. Reload the page.":
		"Diese Organisation oder Anfrage gibt es nicht mehr. Laden Sie die Seite neu.",
	"This browser can't receive notifications. On an iPhone, add ancora to the home screen first.":
		"Dieser Browser kann keine Benachrichtigungen empfangen. Fügen Sie ancora auf dem iPhone zuerst zum Home-Bildschirm hinzu.",
	"Notifications are blocked for ancora. Allow them in the browser's site settings.":
		"Benachrichtigungen für ancora sind blockiert. Erlauben Sie sie in den Website-Einstellungen des Browsers.",
	"Notifications aren't set up on ancora's server yet.":
		"Benachrichtigungen sind auf dem Server von ancora noch nicht eingerichtet.",
	"The anchor sent no sign-in challenge.": "Der Anchor hat keine Anmeldeaufforderung gesendet.",
	"The anchor's sign-in challenge is for another network.":
		"Die Anmeldeaufforderung des Anchors gilt für ein anderes Netzwerk.",
	"The anchor's sign-in challenge was for another account.":
		"Die Anmeldeaufforderung des Anchors galt einem anderen Konto.",
	"The anchor returned no session token.": "Der Anchor hat kein Sitzungstoken zurückgegeben.",
	"The anchor answered in a way ancora doesn't understand.":
		"Der Anchor hat auf eine Weise geantwortet, die ancora nicht versteht.",
	"The anchor couldn't be reached.": "Der Anchor war nicht erreichbar.",
	"The anchor session ended. Start again to sign in once more.":
		"Die Sitzung beim Anchor ist beendet. Beginnen Sie erneut, um sich wieder anzumelden.",
	"The anchor has no record of this transaction.": "Der Anchor kennt diese Transaktion nicht.",
	"This organization seals with quantum-safe keys, and this device has none for you. Create one under Settings → Security seal, or seal from the device that has it.":
		"Diese Organisation versiegelt mit quantensicheren Schlüsseln, und dieses Gerät hat keinen für Sie. Erstellen Sie einen unter Einstellungen → Sicherheitssiegel oder versiegeln Sie auf dem Gerät, das ihn hat.",
	"This isn't an ancora backup code (it starts with ancora-keys-1.).":
		"Das ist kein ancora-Sicherungscode (er beginnt mit ancora-keys-1.).",
	"The backup code is damaged. Copy it again, in full.":
		"Der Sicherungscode ist beschädigt. Kopieren Sie ihn erneut und vollständig.",
	"This browser can't store keys (private window?).":
		"Dieser Browser kann keine Schlüssel speichern (privates Fenster?).",
	"The key store on this device didn't answer.":
		"Der Schlüsselspeicher auf diesem Gerät hat nicht geantwortet.",
	"This organization keeps details private, and this device can't write them yet. Set it up under Settings → Private details.":
		"Diese Organisation hält Angaben vertraulich, und dieses Gerät kann sie noch nicht schreiben. Richten Sie es unter Einstellungen → Vertrauliche Angaben ein.",
	"Set up private details on this device first.":
		"Richten Sie zuerst vertrauliche Angaben auf diesem Gerät ein.",
	"Private references are limited to about 70 characters. Shorten it.":
		"Vertrauliche Verwendungszwecke sind auf etwa 70 Zeichen begrenzt. Kürzen Sie ihn.",
	"This name and note are too long to keep private. Shorten them.":
		"Name und Notiz sind zu lang, um vertraulich zu bleiben. Kürzen Sie sie.",
	"This payment link is incomplete. Ask the organization to send it again.":
		"Dieser Zahlungslink ist unvollständig. Bitten Sie die Organisation, ihn erneut zu senden.",
	"This payment link doesn't exist, or the organization's account can't take payment links.":
		"Diesen Zahlungslink gibt es nicht, oder das Konto der Organisation kann keine Zahlungslinks annehmen.",
	"Stellar can't be reached right now. Try again in a moment.":
		"Stellar ist gerade nicht erreichbar. Versuchen Sie es gleich noch einmal.",
	"Enter the recipient's Stellar address (starts with G or C).":
		"Geben Sie die Stellar-Adresse des Empfängers ein (beginnt mit G oder C).",
	"This Stellar address doesn't exist on testnet yet. The recipient has to fund it first (for example with Friendbot).":
		"Diese Stellar-Adresse gibt es im Testnetz noch nicht. Der Empfänger muss sie zuerst aufladen (zum Beispiel mit Friendbot).",
	"Enter a token contract address (C…) or a classic asset as CODE:ISSUER, like USDC:GBBD…":
		"Geben Sie eine Token-Vertragsadresse (C…) oder ein klassisches Asset als CODE:ISSUER ein, etwa USDC:GBBD…",
	"This contract doesn't describe itself as a token.":
		"Dieser Vertrag weist sich nicht als Token aus.",
	"Enter a name of up to 64 characters.": "Geben Sie einen Namen mit höchstens 64 Zeichen ein.",
	"Creating your pass on Stellar… confirm with your passkey.":
		"Ihr Pass wird auf Stellar erstellt … bestätigen Sie mit Ihrem Passkey.",
	"No passkey was chosen.": "Es wurde kein Passkey gewählt.",
	"Signing in didn't complete. Try again.":
		"Die Anmeldung wurde nicht abgeschlossen. Versuchen Sie es erneut.",
	"Sign in first.": "Melden Sie sich zuerst an.",
	"The picture link isn't valid. Upload the picture again.":
		"Der Bildlink ist ungültig. Laden Sie das Bild erneut hoch.",
	"The picture couldn't be stored right now. Try again shortly.":
		"Das Bild konnte gerade nicht gespeichert werden. Versuchen Sie es in Kürze erneut.",
	"This organization doesn't exist anymore. Reload the page.":
		"Diese Organisation gibt es nicht mehr. Laden Sie die Seite neu.",
	"Enter the person's ancora ID (their account address, starts with C).":
		"Geben Sie die ancora-ID der Person ein (ihre Kontoadresse, beginnt mit C).",
	"Switching templates isn't available on Stellar yet.":
		"Der Wechsel der Vorlage ist auf Stellar noch nicht verfügbar.",
	"This request isn't a held handover. Check the link.":
		"Diese Anfrage ist keine zurückgehaltene Übergabe. Prüfen Sie den Link.",
	"This handover couldn't be read.": "Diese Übergabe ließ sich nicht lesen.",
	"Your account has no signing rule.": "Ihr Konto hat keine Signaturregel.",
	"Reconnecting your passkey…": "Ihr Passkey wird neu verbunden …",
	"Lifeline couldn't be read right now.": "Lifeline ließ sich gerade nicht lesen.",
	"Working…": "Wird ausgeführt …",
	"Saving…": "Wird gespeichert …",
	"Sending to Stellar…": "Wird an Stellar gesendet …",
	"Sending to Stellar… confirm with your passkey if asked.":
		"Wird an Stellar gesendet … bestätigen Sie mit Ihrem Passkey, falls gefragt.",
	"Your passkey session on this device has ended, so nothing was done. Sign out and sign in again with your passkey.":
		"Ihre Passkey-Sitzung auf diesem Gerät ist beendet, daher ist nichts passiert. Melden Sie sich ab und mit Ihrem Passkey wieder an.",
	"ancora's server is unreachable right now. Try again shortly.":
		"Der Server von ancora ist gerade nicht erreichbar. Versuchen Sie es in Kürze erneut.",
	"No wallet was connected.": "Es wurde keine Wallet verbunden.",
	"Your wallet account isn't active on testnet yet. Fund it with Friendbot first.":
		"Ihr Wallet-Konto ist im Testnetz noch nicht aktiv. Laden Sie es zuerst mit Friendbot auf.",
	"The payment couldn't be prepared.": "Die Zahlung konnte nicht vorbereitet werden.",
	"Waiting for your wallet to sign…": "Warten auf die Signatur Ihrer Wallet …",
	"The wallet didn't sign the payment.": "Die Wallet hat die Zahlung nicht signiert.",
	"The network rejected the payment. Check the wallet's XLM balance and try again.":
		"Das Netzwerk hat die Zahlung abgelehnt. Prüfen Sie das XLM-Guthaben der Wallet und versuchen Sie es erneut.",
	"The payment failed on the network. Nothing left your wallet.":
		"Die Zahlung ist im Netzwerk fehlgeschlagen. Nichts hat Ihre Wallet verlassen.",
	"The payment is taking longer than usual. Check your wallet's history in a minute.":
		"Die Zahlung dauert länger als üblich. Prüfen Sie den Verlauf Ihrer Wallet in einer Minute.",
	"Your wallet has no trustline for this exact asset (testnet has several assets called USDC).":
		"Ihre Wallet hat keine Trustline für genau dieses Asset (im Testnetz heißen mehrere Assets USDC).",
	"Your wallet doesn't hold enough of this asset.": "Ihre Wallet hat nicht genug von diesem Asset.",
	"Couldn't read the private details setup":
		"Die Einrichtung vertraulicher Angaben ließ sich nicht lesen",
	"Couldn't set up private details on this device":
		"Vertrauliche Angaben ließen sich auf diesem Gerät nicht einrichten",
	"Couldn't renew the organization's key":
		"Der Schlüssel der Organisation ließ sich nicht erneuern",
	"Couldn't share access": "Der Zugang ließ sich nicht teilen",
	"Couldn't add the auditor": "Der Prüfer ließ sich nicht hinzufügen",
	"Couldn't remove the auditor": "Der Prüfer ließ sich nicht entfernen",
	"Couldn't open this organization": "Diese Organisation ließ sich nicht öffnen",
	"Couldn't read the pot": "Die Kasse ließ sich nicht lesen",
	"Couldn't open the pot": "Die Kasse konnte nicht eröffnet werden",
	"Couldn't move money into the pot": "Geld ließ sich nicht in die Kasse verschieben",
	"Couldn't make the pot's incoming money spendable":
		"Eingegangenes Geld der Kasse ließ sich nicht verfügbar machen",
	"Couldn't take money out of the pot": "Geld ließ sich nicht aus der Kasse entnehmen",
	"Couldn't pay from the pot": "Aus der Kasse ließ sich nicht zahlen",
	"Couldn't read the amount": "Der Betrag ließ sich nicht lesen",
	"Nothing was changed": "Es wurde nichts geändert",
	"Not a Stellar address.": "Keine Stellar-Adresse.",
	"A successor is another member; the quiet period and the wait run from one minute to two years.":
		"Die Nachfolge ist ein anderes Mitglied; die inaktive Zeit und die Wartezeit liegen zwischen einer Minute und zwei Jahren.",
	"Pay with ancora": "Mit ancora bezahlen",
	"The rules are written in {currency}; payments in {asset} take the strictest tier until a live exchange rate is connected.":
		"Die Regeln sind in {currency} geschrieben; Zahlungen in {asset} nehmen die strengste Stufe, bis ein aktueller Wechselkurs verbunden ist.",
	"Send {asset}": "{asset} senden",
	"ancora's demo operator sends test {asset} from its float. Not real money.":
		"Der Demo-Betreiber von ancora sendet Test-{asset} aus seinem Bestand. Kein echtes Geld.",
	"The operator's float of {asset} is empty right now: the issuer's testnet faucet isn't handing any out. Pick another asset for test money, or send {asset} from your own wallet.":
		"Der Bestand des Betreibers an {asset} ist gerade leer: Die Testnetz-Quelle des Ausgebers gibt nichts aus. Wählen Sie eine andere Währung für Testgeld oder senden Sie {asset} aus Ihrer eigenen Wallet.",
	"Add test {asset}": "Test-{asset} hinzufügen",
	"Send {asset} to the organization's address with a wallet that can pay contract addresses (Freighter can; a plain Stellar payment from Hana or Lobstr can't reach a C… address).":
		"Senden Sie {asset} an die Adresse der Organisation, mit einer Wallet, die Vertragsadressen bezahlen kann (Freighter kann das; eine einfache Stellar-Zahlung aus Hana oder Lobstr erreicht keine C…-Adresse).",
	"{asset} (issuer {issuer})": "{asset} (Ausgeber {issuer})",
	"Statement · {month}": "Kontoauszug · {month}",
	"Account on Stellar testnet: {address}": "Konto im Stellar-Testnetz: {address}",
	"Created {date} by ancora": "Erstellt am {date} von ancora",
	"No movements in {month}.": "Keine Bewegungen im {month}.",
	"Approved by {name}": "Freigegeben von {name}",
	"Confidential pot: 1 private payment is in the statement, read with the pot key shared with you.":
		"Vertrauliche Kasse: 1 vertrauliche Zahlung steht im Kontoauszug, gelesen mit dem mit Ihnen geteilten Kassenschlüssel.",
	"Confidential pot: {count} private payments are in the statement, read with the pot key shared with you.":
		"Vertrauliche Kasse: {count} vertrauliche Zahlungen stehen im Kontoauszug, gelesen mit dem mit Ihnen geteilten Kassenschlüssel.",
	"Total {amount}": "Gesamt {amount}",
	"{organization} approved this payment on {date} and set the money aside. It is paid out once both sides confirm: you, the recipient, and the organization.":
		"{organization} hat diese Zahlung am {date} freigegeben und das Geld zurückgelegt. Es wird ausgezahlt, sobald beide Seiten bestätigen: Sie als Empfänger und die Organisation.",
	"{count} days": "{count} Tage",
	"{count} hours": "{count} Stunden",
	"{count} minutes": "{count} Minuten",
	"2 minutes": "2 Minuten",
	now: "jetzt",
	"in {minutes} min": "in {minutes} Min.",
	"in {hours} h {minutes} min": "in {hours} Std. {minutes} Min.",
	"in {days} days": "in {days} Tagen",
	"for new pass {pass}. It can finish {when}. Not you?":
		"für den neuen Pass {pass}. Sie kann {when} abgeschlossen werden. Nicht Sie?",
	"{needed} of {total} confirm · {wait}": "{needed} von {total} bestätigen · {wait}",
	"Recovery in progress: new pass {pass}, confirmed by {confirmed} of {needed}.":
		"Wiederherstellung läuft: neuer Pass {pass}, bestätigt von {confirmed} von {needed}.",
	"Ready: the new pass can complete it.": "Bereit: Der neue Pass kann sie abschließen.",
	"The waiting period ends {when}.": "Die Wartezeit endet {when}.",
	"{needed} of 1 guardian confirm · {wait} waiting period":
		"{needed} von 1 Vertrauensperson bestätigt · {wait} Wartezeit",
	"{needed} of {total} guardians confirm · {wait} waiting period":
		"{needed} von {total} Vertrauenspersonen bestätigen · {wait} Wartezeit",
	"New pass {pass}, confirmed by {confirmed} of {needed} guardians; can finish {when}. If this is not you, cancel it now: your current pass keeps everything.":
		"Neuer Pass {pass}, bestätigt von {confirmed} von {needed} Vertrauenspersonen; kann {when} abgeschlossen werden. Wenn Sie das nicht sind, brechen Sie jetzt ab: Ihr aktueller Pass behält alles.",
	"Positions in {organizations} were created before Lifeline and can't be handed over; new organizations can.":
		"Positionen in {organizations} entstanden vor Lifeline und können nicht übergeben werden; neue Organisationen können das.",
	"Guardians (up to {count})": "Vertrauenspersonen (bis zu {count})",
	"{needed} of {total}": "{needed} von {total}",
	"This pass was already recovered to {pass} (you).":
		"Dieser Pass wurde bereits auf {pass} (Sie) wiederhergestellt.",
	"This pass was already recovered to {pass}.":
		"Dieser Pass wurde bereits auf {pass} wiederhergestellt.",
	"{name} never set up Lifeline, so this pass can't be recovered. Ask the organizations to invite your new pass instead.":
		"{name} hat Lifeline nie eingerichtet, daher kann dieser Pass nicht wiederhergestellt werden. Bitten Sie die Organisationen stattdessen, Ihren neuen Pass einzuladen.",
	"No recovery started yet. One of the {count} guardians has to start it with your new ID.":
		"Noch keine Wiederherstellung begonnen. Eine der {count} Vertrauenspersonen muss sie mit Ihrer neuen ID starten.",
	"Claim for {pass} (this pass): {confirmed} of {needed} guardians confirmed.":
		"Anspruch für {pass} (dieser Pass): {confirmed} von {needed} Vertrauenspersonen haben bestätigt.",
	"Claim for {pass} (not this pass): {confirmed} of {needed} guardians confirmed.":
		"Anspruch für {pass} (nicht dieser Pass): {confirmed} von {needed} Vertrauenspersonen haben bestätigt.",
};
