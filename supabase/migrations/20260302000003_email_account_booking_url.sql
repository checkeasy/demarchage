-- Add booking URL field to email accounts (e.g. TidyCal link)
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS booking_url TEXT DEFAULT NULL;

COMMENT ON COLUMN email_accounts.booking_url IS 'Booking/calendar link (TidyCal, Calendly, etc.) for this email account';
