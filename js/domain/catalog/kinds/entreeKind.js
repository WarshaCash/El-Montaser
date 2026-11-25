import {int} from '../validation.js';

const ENTREE_COUNTS = { min: 1, max: 2 };

/** الانتريه: 1 أو 2 كنبة + 1 أو 2 كرسي + ترابيزة ثابتة. */
const entreeKind = {
  id: 'entree',
  label: 'انتريه (1 أو 2 كنبة + 1 أو 2 كرسي + ترابيزة)',
  summary: () => 'كنبة (1 أو 2) + كرسي (1 أو 2) + ترابيزة',
  normalize(def, raw) {
    const { min, max } = ENTREE_COUNTS;
    const sofas = int(raw.sofas, min, max, 'عدد الكنب');
    const chairs = int(raw.chairs, min, max, 'عدد الكراسي');
    return {
      specs: { sofas, chairs, table: 1 },
      description: `${sofas} كنبة + ${chairs} كرسي + ترابيزة`,
      sizeText: '',
    };
  },
};

export {ENTREE_COUNTS, entreeKind};
