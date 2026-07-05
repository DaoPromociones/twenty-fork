import { createHash } from 'crypto';

type AduanaProjectionEnvelope = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  sourceRecordId: string;
  evidenceId?: string | null;
  summary?: string | null;
};

const TRUSTED_FIELDS = [
  'eventId',
  'eventType',
  'occurredAt',
  'sourceRecordId',
  'evidenceId',
  'summary',
] as const;

const REQUIRED_FIELDS = [
  'eventId',
  'eventType',
  'occurredAt',
  'sourceRecordId',
] as const;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const record = value as Record<string, unknown>;

  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
};

const isOwnProperty = (
  input: Record<string, unknown>,
  field: string,
): boolean => Object.prototype.hasOwnProperty.call(input, field);

const toObjectRecord = (input: unknown): Record<string, unknown> => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Aduana envelope must be a JSON object');
  }

  return input as Record<string, unknown>;
};

const assertStringField = (
  input: Record<string, unknown>,
  field: (typeof REQUIRED_FIELDS)[number],
) => {
  if (!isOwnProperty(input, field)) {
    throw new Error(`Missing required Aduana trusted field: ${field}`);
  }

  if (typeof input[field] !== 'string' || input[field].length === 0) {
    throw new Error(`Invalid required Aduana trusted field: ${field}`);
  }
};

export const canonicalizeAduanaProjectionEnvelope = (input: unknown) => {
  const inputRecord = toObjectRecord(input);

  for (const key of Object.keys(inputRecord)) {
    if (!TRUSTED_FIELDS.includes(key as (typeof TRUSTED_FIELDS)[number])) {
      throw new Error(`Unknown Aduana trusted field: ${key}`);
    }
  }

  for (const field of REQUIRED_FIELDS) {
    assertStringField(inputRecord, field);
  }

  const envelope: AduanaProjectionEnvelope = {
    eventId: inputRecord.eventId as string,
    eventType: inputRecord.eventType as string,
    occurredAt: inputRecord.occurredAt as string,
    sourceRecordId: inputRecord.sourceRecordId as string,
  };

  for (const optionalField of ['evidenceId', 'summary'] as const) {
    if (isOwnProperty(inputRecord, optionalField)) {
      const value = inputRecord[optionalField];

      if (value !== null && value !== undefined && typeof value !== 'string') {
        throw new Error(`Invalid Aduana trusted field: ${optionalField}`);
      }

      envelope[optionalField] = value ?? null;
    }
  }

  return {
    envelope,
    canonicalJson: stableStringify(envelope),
  };
};

export const hashCanonicalAduanaProjectionEnvelope = (
  canonicalJson: string,
): string => createHash('sha256').update(canonicalJson).digest('hex');
