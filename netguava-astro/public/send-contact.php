<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode($status === 200
        ? ['ok' => true, 'message' => $message]
        : ['ok' => false, 'error' => $message]);
    exit;
}

function deliveryError(string $reason, int $status = 500): void
{
    error_log('Netguava contact: ' . $reason);
    respond($status, 'Unable to send your message. Please call (800) 861-8784 or try again later.');
}

function setting(string $name, string $default = ''): string
{
    $value = getenv($name);
    return $value !== false && $value !== ''
        ? $value : (defined($name) ? (string)constant($name) : $default);
}

function field(string $name, int $maxLength = 5000): string
{
    $value = $_POST[$name] ?? '';
    if (!is_string($value) || strlen($value) > $maxLength) {
        respond(422, 'Invalid or oversized form field. Please check your submission.');
    }
    return trim($value);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, 'Method not allowed.');
}
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 9 * 1024 * 1024) {
    respond(413, 'Your submission is too large. Attachments must be no larger than 8 MB.');
}
if ($_POST === [] && $_FILES === []) {
    respond(422, 'No form data received. Please check the upload size and try again.');
}

$configFile = dirname(__DIR__) . '/data/send-contact-config.php';
if (is_file($configFile)) {
    require_once $configFile;
}

$formId = field('form_id', 20);
$forms = [
    'gform_4' => 'Contact',
    'gform_2' => 'Service inquiry',
    'gform_1' => 'Website estimate',
];
if (!isset($forms[$formId])) {
    respond(422, 'Unknown contact form. Please reload the page and try again.');
}
if (field('ak_hp_textarea', 100) !== '') {
    error_log('Netguava contact: submission blocked by honeypot');
    respond(422, 'Your submission could not be accepted. Please call (800) 861-8784.');
}

$name = field('input_1', 120);
$email = field('input_2', 254);
$message = field('input_3');
$phone = field($formId === 'gform_1' ? 'input_8' : 'input_6', 60);
$plan = $formId === 'gform_2' ? field('input_4', 30) : '';
$service = $formId === 'gform_2' ? field('input_5', 100) : '';
$sourcePage = field('source_page', 200);
if ($name === '' || $email === '' || $message === '') {
    respond(422, 'Please enter your name, email, and message.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $email)) {
    respond(422, 'Please enter a valid email address.');
}
if ($formId === 'gform_2' && !in_array($plan, ['Essentials', 'Professional', 'Premium'], true)) {
    respond(422, 'Please select a support plan.');
}

$attachment = null;
if (isset($_FILES['input_4'])) {
    $upload = $_FILES['input_4'];
    if ($formId !== 'gform_1' || !is_array($upload)
        || !isset($upload['error']) || !is_int($upload['error'])) {
        respond(422, 'Invalid attachment.');
    }
    if ($upload['error'] !== UPLOAD_ERR_NO_FILE) {
        if (in_array($upload['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            respond(413, 'Please choose a file no larger than 8 MB.');
        }
        if ($upload['error'] !== UPLOAD_ERR_OK) {
            respond(422, 'The attachment could not be uploaded. Please choose the file again.');
        }
        if (!isset($upload['tmp_name'], $upload['name'])
            || !is_string($upload['tmp_name']) || !is_string($upload['name'])
            || !is_uploaded_file($upload['tmp_name'])) {
            respond(422, 'Invalid attachment.');
        }
        $size = filesize($upload['tmp_name']);
        if ($size === false) {
            deliveryError('unable to read attachment size');
        }
        if ($size > 8388608) {
            respond(413, 'Please choose a file no larger than 8 MB.');
        }
        $attachment = $upload;
    }
}

$apiKey = setting('MAILGUN_API_KEY');
$domain = setting('MAILGUN_DOMAIN');
$to = setting('MAILGUN_TO_EMAIL', 'support@netguava.com');
$from = setting('MAILGUN_FROM_EMAIL', 'Netguava Website <postmaster@' . $domain . '>');
if ($apiKey === '' || $domain === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)
    || preg_match('/[\r\n]/', $from)) {
    deliveryError('Mailgun is not configured correctly');
}
if (!extension_loaded('curl')) {
    deliveryError('PHP cURL extension is unavailable');
}

// Lock the shared send history through delivery so concurrent requests cannot exceed the quota.
$rateFile = setting('CONTACT_RATE_LIMIT_FILE',
    sys_get_temp_dir() . '/netguava-contact-' . sha1(__DIR__) . '.json');
$directory = dirname($rateFile);
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
    deliveryError('unable to create private rate-limit directory');
}
$rateHandle = fopen($rateFile, 'c+');
if ($rateHandle === false || !flock($rateHandle, LOCK_EX)) {
    deliveryError('unable to lock rate-limit storage');
}
$history = stream_get_contents($rateHandle);
if ($history === false) {
    deliveryError('unable to read rate-limit storage');
}
$sent = $history === '' ? [] : json_decode($history, true);
if (!is_array($sent)) {
    deliveryError('invalid rate-limit storage');
}
$now = time();
$recent = [];
$hourCount = 0;
foreach ($sent as $timestamp) {
    if (!is_int($timestamp)) {
        deliveryError('invalid rate-limit timestamp');
    }
    if ($timestamp > $now - 86400) {
        $recent[] = $timestamp;
        if ($timestamp > $now - 3600) {
            $hourCount++;
        }
    }
}
if ($hourCount >= 15 || count($recent) >= 25) {
    error_log('Netguava contact: submission blocked by rate limit');
    header('Retry-After: 3600');
    respond(429, 'The contact form is temporarily busy. Please call (800) 861-8784 or try again later.');
}
// Reserve the send before contacting Mailgun; failed attempts also consume quota.
$recent[] = $now;
$encoded = json_encode($recent);
if ($encoded === false || !rewind($rateHandle) || !ftruncate($rateHandle, 0)
    || fwrite($rateHandle, $encoded) !== strlen($encoded) || !fflush($rateHandle)) {
    deliveryError('unable to save rate-limit storage');
}

$text = "Name: {$name}\nEmail: {$email}\nPhone: {$phone}\n"
    . "Form: {$forms[$formId]}\nService: {$service}\nPlan: {$plan}\n"
    . "Page: {$sourcePage}\n\nMessage:\n{$message}\n";
$payload = [
    'from' => $from,
    'to' => $to,
    'subject' => 'Netguava Website: ' . $forms[$formId],
    'text' => $text,
    'h:Reply-To' => $email,
];
if ($attachment !== null) {
    $filename = basename(str_replace('\\', '/', $attachment['name']));
    $filename = substr(preg_replace('/[^A-Za-z0-9._ -]/', '_', $filename), 0, 180);
    $payload['attachment'] = new CURLFile($attachment['tmp_name'], 'application/octet-stream',
        $filename !== '' ? $filename : 'attachment');
}
$curl = curl_init('https://api.mailgun.net/v3/' . rawurlencode($domain) . '/messages');
if ($curl === false) {
    deliveryError('unable to initialize Mailgun request');
}
if (!curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
    CURLOPT_USERPWD => 'api:' . $apiKey,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 30,
])) {
    deliveryError('unable to configure Mailgun request');
}
$result = curl_exec($curl);
$status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);
flock($rateHandle, LOCK_UN);
fclose($rateHandle);
if ($result === false || $status < 200 || $status >= 300) {
    deliveryError('Mailgun delivery failed (HTTP ' . $status . ')', 502);
}
$receipt = json_decode($result, true);
if (!is_array($receipt) || empty($receipt['id'])) {
    deliveryError('Mailgun returned an invalid receipt', 502);
}
error_log('Netguava contact: email accepted by Mailgun');
respond(200, 'Message sent.');
