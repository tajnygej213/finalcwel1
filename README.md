# Discord Bot - Generator Formularzy StockX

Bot Discord do zarządzania formularzami zamówień StockX z systemem limitów i dostępu czasowego.

## Funkcje

### 📝 Formularz StockX
- Interaktywny formularz w dwóch częściach
- Automatyczne wysyłanie emaili z zamówieniami w **profesjonalnym szablonie StockX**
- Ochrona przed duplikatami - bot nie wyśle formularza ponownie przy restarcie
- **Zapisywanie emaila** - każdy użytkownik może zapisać swój adres email, który będzie automatycznie wypełniany w formularzu

### 👥 Zarządzanie Użytkownikami

#### Limity użyć (Slash Commands)
- `/setlimit` - ustaw limit użyć formularza dla użytkownika (tylko admin)
  - Parametry: `użytkownik` (wymagany), `liczba` (wymagany, 0 lub więcej)
  - Automatycznie wysyła DM do użytkownika
- `/checklimit` - sprawdź limit użyć formularza
  - Parametry: `użytkownik` (opcjonalny, tylko dla adminów)
  - Bez parametru sprawdza swój własny limit
- `/resetlimit` - usuń limit dla użytkownika - nieograniczone użycia (tylko admin)
  - Parametry: `użytkownik` (wymagany)
  - Automatycznie wysyła DM do użytkownika
- `/resetlimits` - zresetuj wszystkie limity (tylko admin)
  - Wszyscy użytkownicy mają nieograniczone użycia


### 📧 Zapisywanie Emaila
- Przycisk **"Ustaw Email"** na kanale #generator
- Zapisz swój adres email raz - nie musisz wpisywać go przy każdym formularzu
- Email jest zapisywany osobno dla każdego użytkownika
- Możesz zmienić email w dowolnym momencie (kliknij ponownie przycisk "Ustaw Email")

### 🛠️ Komendy Administratora (Prefix Commands)

#### Echo
- `!echo #kanał wiadomość` - wyślij wiadomość jako bot na wybrany kanał
- Tylko dla administratorów

#### Dostęp czasowy
- `!setdays @użytkownik liczba_dni` - daj użytkownikowi dostęp na określoną liczbę dni
- Tylko dla administratorów
- Automatycznie wysyła DM do użytkownika

#### Tracker formularzy
- `!resettracker` - zresetuj tracker formularzy (bot wyśle formularz ponownie przy następnym uruchomieniu)
- Tylko dla administratorów

### 📎 Automatyczne Linki
- Na kanale **#link-na-url** bot automatycznie wysyła URL do wrzuconych zdjęć (.jpg, .jpeg, .png, .gif, .webp)

## Konfiguracja

### Wymagane sekrety
Bot wymaga następujących sekretów w Replit Secrets:
- `DISCORD_TOKEN` - token bota Discord
- `EMAIL_HOST` - host SMTP (np. smtp.gmail.com)
- `EMAIL_PORT` - port SMTP (587 dla TLS, 465 dla SSL)
- `EMAIL_USER` - adres email
- `EMAIL_PASS` - hasło do emaila (dla Gmail użyj hasła aplikacji)

### Wymagane kanały Discord
- **#generator** - kanał gdzie bot wysyła formularz
- **#link-na-url** - kanał do automatycznych linków do zdjęć

## Pliki danych

Bot automatycznie tworzy i zarządza następującymi plikami:
- `user_limits.json` - limity użyć dla poszczególnych użytkowników
- `user_access.json` - daty wygaśnięcia dostępu czasowego
- `form_tracker.json` - tracking wysłanych formularzy (zapobiega duplikatom)
- `user_emails.json` - zapisane adresy email użytkowników

## Format daty

W formularzu data powinna być podana w formacie: **DD/MM/RRRR** (np. 22/12/2024)

## Uprawnienia

Większość komend wymaga uprawnień administratora na serwerze Discord.

## Uruchamianie

Bot uruchamia się automatycznie przez workflow "Discord Bot".
