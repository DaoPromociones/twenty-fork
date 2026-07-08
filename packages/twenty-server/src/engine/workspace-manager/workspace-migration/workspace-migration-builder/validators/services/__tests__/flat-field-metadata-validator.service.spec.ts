import { TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'twenty-shared/application';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { DateDisplayFormat, FieldMetadataType } from 'twenty-shared/types';

import { FieldMetadataExceptionCode } from 'src/engine/metadata-modules/field-metadata/field-metadata.exception';
import { createEmptyFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { addFlatEntityToFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/add-flat-entity-to-flat-entity-maps-or-throw.util';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { FlatFieldMetadataTypeValidatorService } from 'src/engine/metadata-modules/flat-field-metadata/services/flat-field-metadata-type-validator.service';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { FlatFieldMetadataValidatorService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/flat-field-metadata-validator.service';
import { buildAduanaProjectionStandardFlatFieldMetadatas } from 'src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/compute-aduana-projection-standard-flat-field-metadata.util';
import { getStandardObjectMetadataRelatedEntityIds } from 'src/engine/workspace-manager/twenty-standard-application/utils/get-standard-object-metadata-related-entity-ids.util';

describe('FlatFieldMetadataValidatorService', () => {
  const validator = new FlatFieldMetadataValidatorService({
    validateFlatFieldMetadataTypeSpecificities: jest.fn().mockReturnValue([]),
  } as unknown as FlatFieldMetadataTypeValidatorService);
  const aduanaProjectionStandardFields =
    buildAduanaProjectionStandardFlatFieldMetadatas({
      objectName: 'aduanaProjection',
      workspaceId: 'workspace-id',
      now: '2026-01-01T00:00:00.000Z',
      twentyStandardApplicationId: 'twenty-standard-application-id',
      dependencyFlatEntityMaps: {
        flatObjectMetadataMaps: createEmptyFlatEntityMaps(),
      },
      standardObjectMetadataRelatedEntityIds:
        getStandardObjectMetadataRelatedEntityIds({
          includeAduanaProjection: true,
        }),
    });

  const buildRemoteObjectMaps = ({
    applicationUniversalIdentifier = TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    isSystem,
    universalIdentifier = STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
  }: {
    applicationUniversalIdentifier?: string;
    isSystem: boolean;
    universalIdentifier?: string;
  }) => {
    const remoteAduanaObject = getFlatObjectMetadataMock({
      universalIdentifier,
      applicationUniversalIdentifier,
      isRemote: true,
      isSystem,
      nameSingular: 'aduanaProjection',
      namePlural: 'aduanaProjections',
      labelSingular: 'Aduana Projection',
      labelPlural: 'Aduana Projections',
    });

    return addFlatEntityToFlatEntityMapsOrThrow({
      flatEntity: remoteAduanaObject,
      flatEntityMaps: createEmptyFlatEntityMaps(),
    });
  };

  const buildAduanaField = ({
    applicationUniversalIdentifier = TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectMetadataUniversalIdentifier = STANDARD_OBJECTS.aduanaProjection
      .universalIdentifier,
    overrides = {},
    universalIdentifier = aduanaProjectionStandardFields.eventId
      .universalIdentifier,
  }: {
    universalIdentifier?: string;
    applicationUniversalIdentifier?: string;
    objectMetadataUniversalIdentifier?: string;
    overrides?: Partial<typeof aduanaProjectionStandardFields.eventId>;
  } = {}) => ({
    ...aduanaProjectionStandardFields.eventId,
    objectMetadataUniversalIdentifier,
    applicationUniversalIdentifier,
    ...overrides,
    universalIdentifier,
  });

  const validateFieldCreation = ({
    buildOptions = {
      isSystemBuild: true,
      applicationUniversalIdentifier:
        TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    },
    field = buildAduanaField(),
    parentApplicationUniversalIdentifier = TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    parentIsSystem = true,
    parentUniversalIdentifier = STANDARD_OBJECTS.aduanaProjection
      .universalIdentifier,
  }: {
    buildOptions?: {
      isSystemBuild: boolean;
      applicationUniversalIdentifier: string;
    };
    field?: ReturnType<typeof buildAduanaField>;
    parentApplicationUniversalIdentifier?: string;
    parentIsSystem?: boolean;
    parentUniversalIdentifier?: string;
  } = {}) =>
    validator.validateFlatFieldMetadataCreation({
      flatEntityToValidate: field,
      optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
        flatFieldMetadataMaps: createEmptyFlatEntityMaps(),
        flatObjectMetadataMaps: buildRemoteObjectMaps({
          applicationUniversalIdentifier: parentApplicationUniversalIdentifier,
          isSystem: parentIsSystem,
          universalIdentifier: parentUniversalIdentifier,
        }),
      },
      buildOptions,
      workspaceId: 'workspace-id',
      remainingFlatEntityMapsToValidate: createEmptyFlatEntityMaps(),
      additionalCacheDataMaps: {},
    } as never);

  const buildCustomField = ({
    applicationUniversalIdentifier = TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectMetadataUniversalIdentifier = STANDARD_OBJECTS.aduanaProjection
      .universalIdentifier,
    universalIdentifier = 'custom-field',
  }: {
    applicationUniversalIdentifier?: string;
    objectMetadataUniversalIdentifier?: string;
    universalIdentifier?: string;
  } = {}) =>
    getFlatFieldMetadataMock({
      universalIdentifier,
      objectMetadataId: 'aduana-object-id',
      objectMetadataUniversalIdentifier,
      applicationUniversalIdentifier,
      type: FieldMetadataType.TEXT,
      name: 'eventId',
      label: 'Event ID',
    });

  const expectRemoteReadOnlyError = (
    result: ReturnType<typeof validateFieldCreation>,
  ) => {
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: FieldMetadataExceptionCode.FIELD_MUTATION_NOT_ALLOWED,
          message: 'Remote objects are read-only',
        }),
      ]),
    );
  };

  it('allows Twenty standard system builds to create Aduana standard fields on the standard remote object', () => {
    const result = validateFieldCreation();

    expect(result.errors).toEqual([]);
  });

  it.each([
    {
      title: 'a custom field on the Aduana remote object',
      args: { field: buildCustomField() },
    },
    {
      title: 'a non-system Aduana remote object',
      args: { parentIsSystem: false },
    },
    {
      title: 'a non-system build',
      args: {
        buildOptions: {
          isSystemBuild: false,
          applicationUniversalIdentifier:
            TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        },
      },
    },
    {
      title: 'a non-Twenty caller',
      args: {
        buildOptions: {
          isSystemBuild: true,
          applicationUniversalIdentifier: 'custom-application',
        },
      },
    },
    {
      title: 'a non-Twenty parent application owner',
      args: { parentApplicationUniversalIdentifier: 'custom-application' },
    },
    {
      title: 'a non-Twenty field application owner',
      args: {
        field: buildAduanaField({
          applicationUniversalIdentifier: 'custom-application',
        }),
      },
    },
    {
      title: 'an arbitrary standard remote object',
      args: {
        field: buildCustomField({
          objectMetadataUniversalIdentifier:
            STANDARD_OBJECTS.attachment.universalIdentifier,
          universalIdentifier:
            STANDARD_OBJECTS.attachment.fields.name.universalIdentifier,
        }),
        parentUniversalIdentifier:
          STANDARD_OBJECTS.attachment.universalIdentifier,
      },
    },
    {
      title:
        'an approved Aduana field universal identifier with an altered name',
      args: { field: buildAduanaField({ overrides: { name: 'alteredName' } }) },
    },
    {
      title:
        'an approved Aduana field universal identifier with an altered type',
      args: {
        field: buildAduanaField({
          overrides: { type: FieldMetadataType.NUMBER },
        }),
      },
    },
    {
      title:
        'an approved Aduana field universal identifier with altered UI flags',
      args: { field: buildAduanaField({ overrides: { isUIEditable: true } }) },
    },
    {
      title:
        'an approved Aduana field universal identifier with altered settings',
      args: {
        field: buildAduanaField({
          overrides: {
            universalSettings: { displayFormat: DateDisplayFormat.CUSTOM },
          },
        }),
      },
    },
  ])('rejects remote field creation for $title', ({ args }) => {
    const result = validateFieldCreation(args);

    expectRemoteReadOnlyError(result);
  });
});
