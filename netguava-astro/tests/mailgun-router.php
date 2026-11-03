<?php
declare(strict_types=1);
namespace NetguavaContactTest;

// Intercept only Mailgun transport; HTTP parsing, uploads and endpoint logic stay real.
function curl_init(string $url): object
{
    return (object)['url' => $url, 'options' => []];
}

function curl_setopt_array(object $curl, array $options): bool
{
    $curl->options = $options;
    return true;
}

function curl_exec(object $curl)
{
    $payload = $curl->options[CURLOPT_POSTFIELDS];
    if (isset($payload['attachment'])) {
        $file = $payload['attachment'];
        $payload['attachment'] = [
            'filename' => $file->getPostFilename(),
            'size' => filesize($file->getFilename()),
        ];
    }
    file_put_contents(getenv('CONTACT_TEST_CAPTURE'), json_encode([
        'url' => $curl->url,
        'payload' => $payload,
    ]));
    if (($_SERVER['HTTP_X_TEST_MAILGUN'] ?? '') === 'network-error') {
        return false;
    }
    return ($_SERVER['HTTP_X_TEST_MAILGUN'] ?? '') === 'bad-receipt'
        ? '{}' : '{"id":"test-mailgun-id","message":"Queued. Thank you."}';
}

function curl_getinfo(object $curl, int $option): int
{
    $status = $_SERVER['HTTP_X_TEST_MAILGUN'] ?? '200';
    return ctype_digit($status) ? (int)$status : 200;
}

function curl_close(object $curl): void
{
}

$source = file_get_contents(dirname(__DIR__) . '/public/send-contact.php');
if (($_SERVER['HTTP_X_TEST_MAILGUN'] ?? '') === 'missing-key') {
    putenv('MAILGUN_API_KEY=');
}
$source = str_replace('declare(strict_types=1);',
    'declare(strict_types=1); namespace NetguavaContactTest; use CURLFile;', $source);
eval(substr($source, 5));
