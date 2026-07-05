import {
  canonicalizeAduanaProjectionEnvelope,
  hashCanonicalAduanaProjectionEnvelope,
} from 'src/modules/aduana-projection/services/aduana-projection-canonicalizer.service';

describe('AduanaProjectionCanonicalizerService', () => {
  it('should create a stable canonical hash while preserving the event timestamp', () => {
    const first = canonicalizeAduanaProjectionEnvelope({
      summary: 'descriptive only',
      sourceRecordId: 'record-1',
      occurredAt: '2026-07-05T19:30:00.000Z',
      eventType: 'customs.released',
      eventId: 'evt-1',
      evidenceId: 'evidence-1',
    });
    const second = canonicalizeAduanaProjectionEnvelope({
      eventId: 'evt-1',
      eventType: 'customs.released',
      occurredAt: '2026-07-05T19:30:00.000Z',
      sourceRecordId: 'record-1',
      evidenceId: 'evidence-1',
      summary: 'descriptive only',
    });

    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(hashCanonicalAduanaProjectionEnvelope(first.canonicalJson)).toBe(
      hashCanonicalAduanaProjectionEnvelope(second.canonicalJson),
    );
    expect(first.envelope.occurredAt).toBe('2026-07-05T19:30:00.000Z');
  });

  it('should reject unknown trusted fields', () => {
    expect(() =>
      canonicalizeAduanaProjectionEnvelope({
        eventId: 'evt-1',
        eventType: 'customs.released',
        occurredAt: '2026-07-05T19:30:00.000Z',
        sourceRecordId: 'record-1',
        authorityOverride: true,
      }),
    ).toThrow('Unknown Aduana trusted field: authorityOverride');
  });

  it('should distinguish null from missing trusted fields', () => {
    const withNull = canonicalizeAduanaProjectionEnvelope({
      eventId: 'evt-1',
      eventType: 'customs.released',
      occurredAt: '2026-07-05T19:30:00.000Z',
      sourceRecordId: 'record-1',
      evidenceId: null,
      summary: null,
    });

    expect(withNull.canonicalJson).toContain('"evidenceId":null');
    expect(() =>
      canonicalizeAduanaProjectionEnvelope({
        eventId: 'evt-1',
        eventType: 'customs.released',
        sourceRecordId: 'record-1',
      }),
    ).toThrow('Missing required Aduana trusted field: occurredAt');
  });
});
