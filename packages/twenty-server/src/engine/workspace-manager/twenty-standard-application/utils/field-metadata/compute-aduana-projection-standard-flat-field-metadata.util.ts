import { msg } from '@lingui/core/macro';
import { DateDisplayFormat, FieldMetadataType } from 'twenty-shared/types';

import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type AllStandardObjectFieldName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-object-field-name.type';
import {
  type CreateStandardFieldArgs,
  createStandardFieldFlatMetadata,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/create-standard-field-flat-metadata.util';
import { i18nLabel } from 'src/engine/workspace-manager/twenty-standard-application/utils/i18n-label.util';

type AduanaProjectionFieldContext = CreateStandardFieldArgs<
  'aduanaProjection',
  FieldMetadataType
>['context'];

type AduanaProjectionFieldBuilderArgs = Omit<
  CreateStandardFieldArgs<'aduanaProjection', FieldMetadataType>,
  'context'
>;

const buildAduanaProjectionField = ({
  args,
  context,
}: {
  args: AduanaProjectionFieldBuilderArgs;
  context: AduanaProjectionFieldContext;
}) => createStandardFieldFlatMetadata({ ...args, context });

export const buildAduanaProjectionStandardFlatFieldMetadatas = (
  args: AduanaProjectionFieldBuilderArgs,
): Record<
  AllStandardObjectFieldName<'aduanaProjection'>,
  FlatFieldMetadata
> => ({
  id: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'id',
      type: FieldMetadataType.UUID,
      label: i18nLabel(msg`Id`),
      description: i18nLabel(msg`Id`),
      icon: 'Icon123',
      isSystem: true,
      isNullable: false,
      isUIEditable: false,
      defaultValue: 'uuid',
    },
  }),
  createdAt: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'createdAt',
      type: FieldMetadataType.DATE_TIME,
      label: i18nLabel(msg`Creation date`),
      description: i18nLabel(msg`Creation date`),
      icon: 'IconCalendar',
      isSystem: true,
      isNullable: false,
      isUIEditable: false,
      defaultValue: 'now',
      settings: { displayFormat: DateDisplayFormat.RELATIVE },
    },
  }),
  updatedAt: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'updatedAt',
      type: FieldMetadataType.DATE_TIME,
      label: i18nLabel(msg`Last update`),
      description: i18nLabel(msg`Last time the record was changed`),
      icon: 'IconCalendarClock',
      isSystem: true,
      isNullable: false,
      isUIEditable: false,
      defaultValue: 'now',
      settings: { displayFormat: DateDisplayFormat.RELATIVE },
    },
  }),
  deletedAt: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'deletedAt',
      type: FieldMetadataType.DATE_TIME,
      label: i18nLabel(msg`Deleted at`),
      description: i18nLabel(msg`Date when the record was deleted`),
      icon: 'IconCalendarMinus',
      isSystem: true,
      isUIEditable: false,
      settings: { displayFormat: DateDisplayFormat.RELATIVE },
    },
  }),
  eventId: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'eventId',
      type: FieldMetadataType.TEXT,
      label: i18nLabel(msg`Event ID`),
      description: i18nLabel(msg`Aduana event identifier`),
      icon: 'IconId',
      isUIEditable: false,
    },
  }),
  eventType: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'eventType',
      type: FieldMetadataType.TEXT,
      label: i18nLabel(msg`Event type`),
      description: i18nLabel(msg`Aduana event type`),
      icon: 'IconTag',
      isUIEditable: false,
    },
  }),
  occurredAt: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'occurredAt',
      type: FieldMetadataType.DATE_TIME,
      label: i18nLabel(msg`Occurred at`),
      description: i18nLabel(msg`Time when the Aduana event occurred`),
      icon: 'IconCalendarEvent',
      isUIEditable: false,
    },
  }),
  sourceRecordId: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'sourceRecordId',
      type: FieldMetadataType.TEXT,
      label: i18nLabel(msg`Source record ID`),
      description: i18nLabel(msg`Aduana source record identifier`),
      icon: 'IconDatabase',
      isUIEditable: false,
    },
  }),
  evidenceId: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'evidenceId',
      type: FieldMetadataType.TEXT,
      label: i18nLabel(msg`Evidence ID`),
      description: i18nLabel(msg`Aduana evidence identifier`),
      icon: 'IconFileCertificate',
      isUIEditable: false,
    },
  }),
  summary: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'summary',
      type: FieldMetadataType.RICH_TEXT,
      label: i18nLabel(msg`Summary`),
      description: i18nLabel(msg`Non-authoritative Aduana projection summary`),
      icon: 'IconFileText',
      isUIEditable: false,
    },
  }),
  ingestionStatus: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'ingestionStatus',
      type: FieldMetadataType.SELECT,
      label: i18nLabel(msg`Ingestion status`),
      description: i18nLabel(msg`Aduana ingestion classification`),
      icon: 'IconProgressCheck',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "'ACCEPTED'",
      options: [
        {
          id: 'a0ac3008-3da3-4bdf-9abf-38ff3d3f363a',
          value: 'ACCEPTED',
          label: i18nLabel(msg`Accepted`),
          position: 0,
          color: 'green',
        },
        {
          id: 'c8a9b3d5-59e7-4246-bdb0-f0b02a18f1b8',
          value: 'REPLAYED',
          label: i18nLabel(msg`Replayed`),
          position: 1,
          color: 'blue',
        },
        {
          id: 'd48ddf2d-eb06-4d16-9991-586f1d813a48',
          value: 'QUARANTINED',
          label: i18nLabel(msg`Quarantined`),
          position: 2,
          color: 'red',
        },
      ],
    },
  }),
  quarantineReason: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'quarantineReason',
      type: FieldMetadataType.TEXT,
      label: i18nLabel(msg`Quarantine reason`),
      description: i18nLabel(msg`Why this projection is quarantined`),
      icon: 'IconAlertTriangle',
      isUIEditable: false,
    },
  }),
  receivedAt: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'receivedAt',
      type: FieldMetadataType.DATE_TIME,
      label: i18nLabel(msg`Received at`),
      description: i18nLabel(msg`Time when Twenty received the Aduana event`),
      icon: 'IconInbox',
      isNullable: false,
      isUIEditable: false,
    },
  }),
  createdBy: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'createdBy',
      type: FieldMetadataType.ACTOR,
      label: i18nLabel(msg`Created by`),
      description: i18nLabel(msg`The creator of the record`),
      icon: 'IconCreativeCommonsSa',
      isSystem: true,
      isNullable: false,
      isUIEditable: false,
      defaultValue: {
        source: "'MANUAL'",
        name: "'System'",
        workspaceMemberId: null,
      },
    },
  }),
  updatedBy: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'updatedBy',
      type: FieldMetadataType.ACTOR,
      label: i18nLabel(msg`Updated by`),
      description: i18nLabel(
        msg`The workspace member who last updated the record`,
      ),
      icon: 'IconUserCircle',
      isSystem: true,
      isNullable: false,
      isUIEditable: false,
      defaultValue: {
        source: "'MANUAL'",
        name: "'System'",
        workspaceMemberId: null,
      },
    },
  }),
  position: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'position',
      type: FieldMetadataType.POSITION,
      label: i18nLabel(msg`Position`),
      description: i18nLabel(msg`Aduana projection record position`),
      icon: 'IconHierarchy2',
      isSystem: true,
      isNullable: false,
      isUIEditable: false,
      defaultValue: 0,
    },
  }),
  searchVector: buildAduanaProjectionField({
    args,
    context: {
      fieldName: 'searchVector',
      type: FieldMetadataType.TS_VECTOR,
      label: i18nLabel(msg`Search vector`),
      description: i18nLabel(msg`Field used for full-text search`),
      icon: 'IconUser',
      isSystem: true,
      isUIEditable: false,
    },
  }),
});
