<?php
declare(strict_types=1);

// Copy to /home/sitefolder/data/send-contact-config.php.
// The PHP document root is /home/sitefolder/wwwroot.
const MAILGUN_API_KEY = 'key-your-mailgun-api-key';
const MAILGUN_DOMAIN = 'notifications.netguava.com';
const MAILGUN_TO_EMAIL = 'support@netguava.com';
const MAILGUN_FROM_EMAIL = 'Netguava Website <no-reply@notifications.netguava.com>';
// Must be writable by PHP and outside the public document root.
const CONTACT_RATE_LIMIT_FILE = __DIR__ . '/contact-rate-limit.json';
