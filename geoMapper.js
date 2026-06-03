const clubs = require('./clubs.json');

/*
  Match longest names first.

  Example:
  "manchester united"
  should match before
  "manchester"

  "inter miami"
  should match before
  "miami"
*/

const clubKeys = Object.keys(clubs)
  .sort((a, b) => b.length - a.length);

function detectClub(title = '') {

  const text = String(title).toLowerCase();

  for (const club of clubKeys) {

    if (!text.includes(club)) continue;

    const data = clubs[club];

    return {
      club,

      city: data.city || null,

      lat:
        typeof data.lat === 'number'
          ? data.lat
          : null,

      lng:
        typeof data.lng === 'number'
          ? data.lng
          : null,

      region:
        data.region || 'global'
    };
  }

  return null;
}

module.exports = {
  detectClub
};
