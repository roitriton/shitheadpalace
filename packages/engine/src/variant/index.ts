export {
  CONFIGURABLE_POWERS,
  JACK_ONLY_POWERS,
  DEFAULT_POWER_ASSIGNMENTS,
  createVariant,
} from './defaults';

export type { VariantValidationError } from './validate';
export { validateVariant, assertVariantValid } from './validate';

export { serializeVariant, deserializeVariant } from './serialize';
