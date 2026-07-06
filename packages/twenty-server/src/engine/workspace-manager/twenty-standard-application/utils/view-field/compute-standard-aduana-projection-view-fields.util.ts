import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import {
  type CreateStandardViewFieldArgs,
  createStandardViewFieldFlatMetadata,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view-field/create-standard-view-field-flat-metadata.util';

const APPROVED_VIEW_FIELDS = [
  'eventId',
  'eventType',
  'occurredAt',
  'sourceRecordId',
  'evidenceId',
  'summary',
  'ingestionStatus',
  'quarantineReason',
  'receivedAt',
] as const;

const VIEW_FIELD_SIZE_BY_FIELD_NAME = {
  eventId: 180,
  eventType: 160,
  occurredAt: 160,
  sourceRecordId: 180,
  evidenceId: 180,
  summary: 240,
  ingestionStatus: 160,
  quarantineReason: 240,
  receivedAt: 160,
} as const satisfies Record<(typeof APPROVED_VIEW_FIELDS)[number], number>;

export const computeStandardAduanaProjectionViewFields = (
  args: Omit<CreateStandardViewFieldArgs<'aduanaProjection'>, 'context'>,
): Record<string, FlatViewField> => {
  return Object.fromEntries([
    ...APPROVED_VIEW_FIELDS.map((fieldName, position) => [
      `allAduanaProjections${fieldName[0].toUpperCase()}${fieldName.slice(1)}`,
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'aduanaProjection',
        context: {
          viewName: 'allAduanaProjections',
          viewFieldName: fieldName,
          fieldName,
          position,
          isVisible: true,
          size: VIEW_FIELD_SIZE_BY_FIELD_NAME[fieldName],
        },
      }),
    ]),
    ...APPROVED_VIEW_FIELDS.map((fieldName, position) => [
      `aduanaProjectionRecordPageFields${fieldName[0].toUpperCase()}${fieldName.slice(1)}`,
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'aduanaProjection',
        context: {
          viewName: 'aduanaProjectionRecordPageFields',
          viewFieldName: fieldName,
          fieldName,
          position,
          isVisible: true,
          size: VIEW_FIELD_SIZE_BY_FIELD_NAME[fieldName],
        },
      }),
    ]),
  ]);
};
