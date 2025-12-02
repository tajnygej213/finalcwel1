# Overview

This is a Discord bot for managing multi-brand order forms with user access control and automated email delivery. The bot provides an interactive multi-modal form system (2-3 modals depending on template) that collects order details, sends confirmation emails with brand-specific templates, and enforces usage limits and time-based access restrictions for users. It supports 10 brand templates (StockX, Apple, Balenciaga, Bape, Dior, LV, Moncler, Nike, Stussy, Trapstar) with template-specific fields and placeholder mapping. The bot also includes admin utilities for message broadcasting and automatic image URL extraction.

## Recent Changes (December 2, 2025)

- **Redeem code system**: Added `/redeem` slash command for users to activate access codes
- **Admin web panel**: Created web interface at port 5000 for generating and managing access codes
  - Password-protected admin login
  - Bulk code generation (31 days or lifetime)
  - Code filtering and download as TXT
  - Statistics dashboard
- **Code types**: 31 days access and lifetime (100 years) access codes
- **Security fix**: Moved Discord token from hardcoded to environment variable

## Changes (October 24, 2025)

- **Image URL validation**: Added automatic validation to ensure image URLs are public HTTPS links
- **Improved modal labels**: Image URL field now shows "PUBLICZNY URL!" reminder with Imgur example placeholder
- **Error messages**: Clear guidance when users provide invalid image URLs (local files, non-HTTPS, etc.)
- **Settings button fix**: Removed file I/O operations before showing modal to prevent Discord 3-second timeout
- **Comprehensive error handling**: Added try-catch blocks to all button interactions

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure

**Single-file Node.js application** - The bot logic is contained primarily in `index.js` with minimal separation of concerns. This monolithic structure keeps the codebase simple but may benefit from modularization as features grow.

**File-based persistence** - The application uses JSON files for data storage rather than a traditional database:
- `user_limits.json` - Stores per-user form submission limits
- `user_access.json` - Tracks time-based access expiration dates
- `form_tracker.json` - Prevents duplicate form submissions on bot restart
- `user_emails.json` - Stores saved email addresses per user for auto-fill functionality

*Rationale*: File-based storage is chosen for simplicity and ease of deployment on Replit. No database setup required. Trade-off is limited scalability and no transactional guarantees, but acceptable for small-to-medium bot deployments.

## Discord Integration

**Discord.js v14** - Uses the official Discord JavaScript library with Gateway intents for:
- Guild and message events
- Button interactions for form navigation
- Modal interactions for data collection

**Multi-stage form workflow with dropdown template selection**:
1. User clicks "Wypełnij formularz zamówienia" button
2. Bot displays dropdown menu (StringSelectMenu) with 10 brand templates
3. User selects template from dropdown → First modal opens (brand, product, size, price)
4. Bot responds with second modal (email, date, image + template-specific fields)
5. For complex templates (Bape, Moncler): Bot shows "Continue" button → Third modal opens for additional fields
6. Bot processes complete data and sends email using selected brand template

*Design choice*: Using Discord's StringSelectMenu for template selection provides better UX than text input - users see all 10 options with emojis and descriptions before choosing. Discord modals have a 5-input limit, requiring multi-stage approach. First modal collects brand, product, size, and price (4 fields). Second modal dynamically adds fields based on template requirements (e.g., Style ID for StockX/Bape/Trapstar, Colour for Balenciaga/Moncler, Taxes for Bape/Dior). Third modal (when needed) handles overflow fields that don't fit in modal 2 (e.g., Currency for Bape; Card End + Estimated Delivery for Moncler).

**Channel-specific functionality**:
- `#generator` - Form submission channel with two buttons:
  - "Wypełnij formularz zamówienia" - Opens the three-stage multi-brand order form (dropdown → modal 1 → modal 2)
  - "Ustawienia" - Opens two-part settings modal where users save their personal information (name, email, address, city, postal code, country) for auto-fill in order forms
- `#link-na-url` - Automatic image URL extraction channel

## Access Control System

**Dual-layer access management**:

1. **Usage limits** - Administrators can set maximum form submissions per user
   - Unlimited access by default (value: -1)
   - Decrements on each successful form submission
   - Prevents abuse while allowing flexibility

2. **Time-based access** - Grant users temporary access for N days
   - Expiration date stored in user_access.json
   - Validated on form open
   - Automatic DM notifications to users

*Rationale*: Two separate systems provide flexibility - limits control quantity, time-based access controls duration. Can be used independently or combined.

## Email Delivery

**Nodemailer SMTP integration** - Sends HTML-formatted order confirmations

**Multi-template system** - Supports 10 brand-specific HTML email templates:
- **Available templates**: StockX, Apple, Balenciaga, Bape, Dior, LV, Moncler, Nike, Stussy, Trapstar
- **Dynamic template selection**: Users choose template from dropdown, bot loads corresponding HTML file
- **Template configuration mapping**: `TEMPLATE_CONFIG` object defines required fields for each template
  - **Configuration flags**: needsStyleId, needsColour, needsTaxes, needsReference, needsFirstName, needsWholeName, needsQuantity, needsCurrency, needsPhoneNumber, needsCardEnd, needsEstimatedDelivery, needsModal3
  - **Modal 3 templates**: Bape (currency + cardEnd), Moncler (cardEnd + estimatedDelivery) use 3-modal flow
- **Placeholder replacement order**: Critical fix - specific placeholders (PRODUCT_SUBTOTAL, PRODUCT_QTY, PRODUCT_PRICE, PRODUCT_COLOUR, PRODUCTSTYLE, PRODUCTSIZE) are replaced BEFORE generic PRODUCT to prevent overwriting. This ensures "Qty 2" displays correctly instead of being replaced with "airpods_QTY"
- **Placeholder normalization**: Comprehensive regex replacement handles 40+ placeholder formats including:
  - Product: PRODUCT_NAME, PRODUCTNAME, PRODUCT, PRODUCT_IMAGE, PRODUCT_LINK, STYLE_ID, PRODUCTSTYLE, SIZE, PRODUCTSIZE, PRODUCT_COLOUR, COLOUR
  - Pricing: PRICE, PRODUCT_PRICE, PRODUCTPRICE, PRODUCT_SUBTOTAL, FEE, SHIPPING, TAXES, TOTAL, ORDER_TOTAL, CARTTOTAL
  - Order: ORDER_NUMBER, ORDERNUMBER, DATE, ORDERDATE, PRODUCT_QTY, QUANTITY
  - User: EMAIL, FIRSTNAME, FIRST_NAME, WHOLE_NAME, WHOLENAME, PHONE_NUMBER
  - Address: ADDRESS1-5, BILLING1-5, BILLING_JAN, SHIPPING1-5, SHIPPING_JAN
  - Template-specific: REFERENCE, CURRENCY_STR, CURRENCY, CARD_END, ESTIMATED_DELIVERY
- **Auto-fill from user_settings.json**: Name, address, city, postal code, country auto-populate from saved settings
- Simple string replacement via regex for dynamic content
- HTML escaping for user input to prevent injection
- Inline images via URL references
- Authentic brand visual styling for each template

*Design decision*: Template approach chosen over programmatic HTML generation for easier design updates. Using authentic brand templates ensures professional appearance and brand consistency. Configuration-driven system with needsModal3 flag allows templates with complex field requirements to use 3-modal flow without code changes.

## Anti-duplicate System

**Form tracker mechanism** - Prevents re-sending forms on bot restart:
- Composite key: `{channelId}_{userId}`
- Stores message ID and timestamp
- Checked before posting new form button

*Problem solved*: Without tracking, bot restart would re-post form buttons, potentially causing confusion and duplicate submissions.

## Command System

**Hybrid command system** - Uses both slash commands and prefix commands:

**Slash Commands** (`/command`) - Modern Discord command interface:
- Registered via Discord API on bot startup
- Auto-completion and parameter validation
- Better UX with dropdown menus
- Permission enforcement via `setDefaultMemberPermissions`
- Commands:
  - `/setlimit` - Set form submission limit for a user (admin only)
  - `/resetlimit` - Remove limit for a user (unlimited access)
  - `/resetlimits` - Reset all limits for all users
  - `/checklimit` - Check form submission limit for yourself or another user
  - `/grantaccess` - Give user time-based access for N days (admin only)
  - `/checkaccess` - Check how many days of access are left

**Prefix-based commands** (`!command`) - Traditional command pattern:
- No registration required
- Immediate deployment
- Permission checks via Discord.js PermissionFlagsBits
- Commands: `!echo`, `!setdays`, `!resettracker`

*Design choice*: User limit management and time-based access moved to slash commands for better UX. `/grantaccess` provides modern alternative to `!setdays`. Admin utility commands remain prefix-based for simplicity.

# External Dependencies

## Discord API
- **discord.js v14.23.2** - Primary framework for Discord bot functionality
- Requires `DISCORD_TOKEN` secret for authentication
- Uses Gateway intents for real-time event handling

## Email Service (SMTP)
- **nodemailer v6.10.1** - Email sending library
- Configurable SMTP server via environment variables:
  - `EMAIL_HOST` - SMTP server hostname
  - `EMAIL_PORT` - SMTP port (587 TLS or 465 SSL)
  - `EMAIL_USER` - Authentication username
  - `EMAIL_PASS` - Authentication password (app-specific password for Gmail)

## Node.js Runtime
- **dotenv v16.6.1** - Environment variable management
- Requires Node.js v16.11.0 or higher (per discord.js requirements)

## User Settings System

**Two-part settings modal** - Collects comprehensive user information for auto-fill:
- Part 1: Full name, email, street, city, postal code (5 fields - Discord modal limit)
- Part 2: Country (1 field)
- Data persisted in `user_settings.json`
- Automatically populates ADDRESS1-5 and BILLING1-5 placeholders in email templates
- Fallback to default values if settings not configured

**Template-specific enhancements**:
- **Apple template**: Added `needsQuantity` flag to enable dynamic quantity input
  - User inputs quantity in second modal
  - Backend calculates: `subtotal = price * quantity`
  - Email displays both unit price (PRODUCT_PRICE) and line total (PRODUCT_SUBTOTAL)
  - Final total includes: subtotal + processing fee ($5.95) + shipping ($12.95)
  - Placeholders: PRODUCT_PRICE (unit), PRODUCT_SUBTOTAL (qty * price), PRODUCT_QTY (e.g., "Qty 2")

## File System
- Node.js built-in `fs` module for JSON persistence
- No external database dependencies
- Data stored in project directory (ephemeral on some hosting platforms)
- Files: `user_limits.json`, `user_access.json`, `form_tracker.json`, `user_emails.json`, `user_settings.json`

# Local Deployment

**Windows Deployment Tools** - The project includes automated scripts for easy local installation:
- `setup.bat` - Automated installation script that checks Node.js, installs dependencies, and creates .env file
- `start.bat` - Convenient startup script with pre-flight checks
- `reset_limits.bat` - Utility to reset all user limits and grant unlimited access
- `.env.example` - Template configuration file with detailed instructions
- `INSTRUKCJA.txt` - Complete Polish-language setup guide

**Installation Process**:
1. Download project as ZIP from Replit (Menu → Download as zip)
2. Extract to local directory (e.g., C:\DiscordBot\)
3. Run `setup.bat` to install dependencies and create .env
4. Configure .env with Discord token, Guild ID, and Gmail credentials
5. Run `start.bat` to launch the bot

**Common Issues**:
- Email not sending: Check if user has limit=0 in user_limits.json (run reset_limits.bat to fix)
- Invalid token: Verify DISCORD_TOKEN in .env
- Connection refused: Check EMAIL_PASS is app-specific password from Google, not regular Gmail password
- "Unknown interaction" error: Fixed by adding deferReply() to button handler (line 843) to respond within Discord's 3-second timeout