const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join('data', 'inbound-observations.jsonl');
const SENSITIVE_PATTERN = /(rawBody|payload bruto|x-hub-signature-256|authorization|access[_-]?token|app[_-]?secret|verify[_-]?token|sha256=[a-f0-9]{64}|\+?\d{10,15})/i;

function buildFirstInboundReport({ filePath = process.env.TEFFE_INBOUND_OBSERVATION_FILE || DEFAULT_FILE } = {}) {
  if (!fs.existsSync(filePath)) {
    return fail('observation_file_missing', 'No inbound observation file was found');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  if (SENSITIVE_PATTERN.test(raw)) {
    return fail('sensitive_data_detected', 'Observation file contains sensitive-looking data');
  }

  const records = raw.split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  if (records.length === 0) {
    return fail('no_events', 'No inbound event was recorded');
  }

  const failures = [];
  const first = records[0];
  if (!records.some((record) => record.signature === 'valid')) {
    failures.push('signature_not_validated');
  }
  if (records.some((record) => !isMaskedPhone(record.sender))) {
    failures.push('phone_not_masked');
  }
  if (records.some((record) => record.outbound?.blocked !== true)) {
    failures.push('outbound_not_blocked');
  }
  if (records.some((record) => record.idempotency === 'duplicate' && record.workflow)) {
    failures.push('duplicate_reexecuted_workflow');
  }

  const summary = {
    ok: failures.length === 0,
    eventCount: records.length,
    firstTimestamp: first.timestamp,
    provider: first.provider,
    tenant: first.tenantId,
    messageType: first.messageType,
    signature: first.signature,
    parser: first.parser,
    idempotency: first.idempotency,
    workflow: first.workflow,
    processing: first.processing,
    outboundBlocked: first.outbound?.blocked === true,
    conclusion: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
  };

  return summary;
}

function fail(code, message) {
  return {
    ok: false,
    eventCount: 0,
    conclusion: 'FAIL',
    failures: [code],
    message,
  };
}

function isMaskedPhone(value) {
  const text = String(value ?? '');
  return text === '' || /\*{3,}/.test(text);
}

if (require.main === module) {
  try {
    const result = buildFirstInboundReport();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      conclusion: 'FAIL',
      failures: ['report_failed'],
      message: error.message,
    }, null, 2));
    process.exit(1);
  }
}

module.exports = { buildFirstInboundReport };
