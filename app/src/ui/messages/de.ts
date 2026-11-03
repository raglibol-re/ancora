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
	"Real on testnet": "Echt im Testnet",
	"Rules the organization enforces itself": "Regeln, die die Organisation selbst durchsetzt",
	"Each organization is its own contract. Approval tiers, four-eyes, objection windows and new-recipient checks run on-chain, and the rules are one readable document whose fingerprint the contract stores.":
		"Jede Organisation ist ein eigener Vertrag. Freigabestufen, Vier-Augen-Prinzip, Einspruchsfristen und Prüfungen neuer Empfänger laufen on-chain, und die Regeln sind ein lesbares Dokument, dessen Fingerabdruck der Vertrag speichert.",
	"Several stablecoins, one account": "Mehrere Stablecoins, ein Konto",
	"EURC, USDC and more side by side, each with its own balance. Rules are written in your home currency; adding a stablecoin is a decision the organization takes together.":
		"EURC, USDC und mehr nebeneinander, jeweils mit eigenem Saldo. Die Regeln gelten in Ihrer Heimatwährung; einen Stablecoin hinzuzufügen entscheidet die Organisation gemeinsam.",
	"A Reserve, not a savings account": "Eine Reserve, kein Sparkonto",
	"Idle money goes into a DeFindex vault on Stellar with one tap and comes back whenever you need it. Earnings are variable and come from Blend lending, not from the stablecoin itself. Not a bank deposit, not insured.":
		"Ungenutztes Geld fließt mit einem Tippen in einen DeFindex-Tresor auf Stellar und kommt zurück, wann immer Sie es brauchen. Die Erträge sind variabel und stammen aus Blend-Krediten, nicht aus dem Stablecoin selbst. Keine Bankeinlage, nicht versichert.",
	"Real on testnet (BlendUSDC)": "Echt im Testnet (BlendUSDC)",
	"A security seal for large payments": "Ein Sicherheitssiegel für große Zahlungen",
	"Above a threshold the organization sets, a payment needs an extra seal from an approver. Organizations can require it to be signed with a quantum-safe ML-DSA key that never leaves the approving device; the organization checks it on Stellar before the money moves.":
		"Ab einer Schwelle, die die Organisation festlegt, braucht eine Zahlung ein zusätzliches Siegel einer freigebenden Person. Organisationen können verlangen, dass es mit einem quantensicheren ML-DSA-Schlüssel signiert wird, der das freigebende Gerät nie verlässt; die Organisation prüft es auf Stellar, bevor Geld fließt.",
	"Real on testnet (opt-in per organization)": "Echt im Testnet (pro Organisation wählbar)",
	"Decide together": "Gemeinsam entscheiden",
	"Reasons for and against, questions and comments on every request, with thumbs up and down. Approvers see what the group thinks before they sign.":
		"Gründe dafür und dagegen, Fragen und Kommentare zu jeder Anfrage, mit Daumen hoch und runter. Wer freigibt, sieht vor der Unterschrift, was die Gruppe denkt.",
	Real: "Echt",
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
	"Roadmap (GitHub)": "Roadmap (GitHub)",
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
	"Non-custodial, labeled honestly": "Ohne Verwahrung, ehrlich gekennzeichnet",
	"Nobody but the organization controls its money. Everything simulated is labeled as such; this demo runs on the Stellar testnet with test money.":
		"Niemand außer der Organisation verfügt über ihr Geld. Alles Simulierte ist als solches gekennzeichnet; diese Demo läuft im Stellar-Testnet mit Testgeld.",
	"ancora is not a bank. Balances are not deposit-insured. Built for HackMeridian 2026 on the Stellar testnet.":
		"ancora ist keine Bank. Guthaben unterliegen keiner Einlagensicherung. Entwickelt für HackMeridian 2026 im Stellar-Testnet.",
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
};
