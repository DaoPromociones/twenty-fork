import { ViewKey, ViewType } from 'twenty-shared/types';

import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import {
  type CreateStandardViewArgs,
  createStandardViewFlatMetadata,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view/create-standard-view-flat-metadata.util';

export const computeStandardAduanaProjectionViews = (
  args: Omit<CreateStandardViewArgs<'aduanaProjection'>, 'context'>,
): Record<string, FlatView> => ({
  allAduanaProjections: createStandardViewFlatMetadata({
    ...args,
    objectName: 'aduanaProjection',
    context: {
      viewName: 'allAduanaProjections',
      name: 'All {objectLabelPlural}',
      type: ViewType.TABLE,
      key: ViewKey.INDEX,
      position: 0,
      icon: 'IconList',
    },
  }),
  aduanaProjectionRecordPageFields: createStandardViewFlatMetadata({
    ...args,
    objectName: 'aduanaProjection',
    context: {
      viewName: 'aduanaProjectionRecordPageFields',
      name: 'Aduana Projection Record Page Fields',
      type: ViewType.FIELDS_WIDGET,
      key: null,
      position: 0,
      icon: 'IconList',
    },
  }),
});
