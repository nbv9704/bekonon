    const SORT_MODES = {
        DATE: 'date',
        NAME: 'name',
        RARITY: 'rarity',
        NUMBER: 'number',
    };

    const SORT_MODE_LABELS = {
        [SORT_MODES.DATE]: 'Date Received',
        [SORT_MODES.NAME]: 'Character Name',
        [SORT_MODES.RARITY]: 'Rarity Level',
        [SORT_MODES.NUMBER]: 'Serial Number',
    };

    const ITEMS_PER_PAGE = 10;

    module.exports = {
        SORT_MODES,
        SORT_MODE_LABELS,
        ITEMS_PER_PAGE,
    };