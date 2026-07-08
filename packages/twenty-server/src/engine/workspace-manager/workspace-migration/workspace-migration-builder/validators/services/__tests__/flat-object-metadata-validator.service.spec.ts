import { TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'twenty-shared/application';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { createEmptyFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { ObjectMetadataExceptionCode } from 'src/engine/metadata-modules/object-metadata/object-metadata.exception';
import { FlatObjectMetadataValidatorService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/flat-object-metadata-validator.service';

describe('FlatObjectMetadataValidatorService', () => {
  const validator = new FlatObjectMetadataValidatorService();

  it('allows Twenty standard system builds to create standard remote objects', () => {
    const result = validator.validateFlatObjectMetadataCreation({
      flatEntityToValidate: getFlatObjectMetadataMock({
        universalIdentifier:
          STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
        applicationUniversalIdentifier:
          TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        isRemote: true,
        isSystem: true,
        nameSingular: 'aduanaProjection',
        namePlural: 'aduanaProjections',
        labelSingular: 'Aduana Projection',
        labelPlural: 'Aduana Projections',
      }),
      optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
        flatObjectMetadataMaps: createEmptyFlatEntityMaps(),
      },
      buildOptions: {
        isSystemBuild: true,
        applicationUniversalIdentifier:
          TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
      },
    } as never);

    expect(result.errors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ObjectMetadataExceptionCode.INVALID_OBJECT_INPUT,
          message: 'Remote objects are not supported yet',
        }),
      ]),
    );
  });

  it('rejects non-standard remote object creation', () => {
    const result = validator.validateFlatObjectMetadataCreation({
      flatEntityToValidate: getFlatObjectMetadataMock({
        universalIdentifier: 'custom-remote-object',
        applicationUniversalIdentifier: 'custom-application',
        isRemote: true,
      }),
      optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
        flatObjectMetadataMaps: createEmptyFlatEntityMaps(),
      },
      buildOptions: {
        isSystemBuild: false,
        applicationUniversalIdentifier: 'custom-application',
      },
    } as never);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ObjectMetadataExceptionCode.INVALID_OBJECT_INPUT,
          message: 'Remote objects are not supported yet',
        }),
      ]),
    );
  });

  it.each([
    {
      title: 'a non-Aduana standard object',
      objectMetadata: {
        universalIdentifier: STANDARD_OBJECTS.note.universalIdentifier,
        isSystem: true,
        nameSingular: 'note',
        namePlural: 'notes',
        labelSingular: 'Note',
        labelPlural: 'Notes',
      },
    },
    {
      title: 'a non-system Aduana object',
      objectMetadata: {
        universalIdentifier:
          STANDARD_OBJECTS.aduanaProjection.universalIdentifier,
        isSystem: false,
        nameSingular: 'aduanaProjection',
        namePlural: 'aduanaProjections',
        labelSingular: 'Aduana Projection',
        labelPlural: 'Aduana Projections',
      },
    },
  ])(
    'rejects standard-app system-build remote creation for $title',
    ({ objectMetadata }) => {
      const result = validator.validateFlatObjectMetadataCreation({
        flatEntityToValidate: getFlatObjectMetadataMock({
          ...objectMetadata,
          applicationUniversalIdentifier:
            TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
          isRemote: true,
        }),
        optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
          flatObjectMetadataMaps: createEmptyFlatEntityMaps(),
        },
        buildOptions: {
          isSystemBuild: true,
          applicationUniversalIdentifier:
            TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        },
      } as never);

      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: ObjectMetadataExceptionCode.INVALID_OBJECT_INPUT,
            message: 'Remote objects are not supported yet',
          }),
        ]),
      );
    },
  );
});
